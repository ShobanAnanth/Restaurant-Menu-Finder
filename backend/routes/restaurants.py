import concurrent.futures
import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

log = logging.getLogger("scrape")
log.setLevel(logging.INFO)

from database import SessionLocal, get_db
from models import MenuItem, MenuSection, Restaurant
from schemas import MenuStatusOut, RestaurantOut, RestaurantWithMenuOut
from services.places_service import radius_to_meters, search_nearby_restaurants
from services.scraper_service import scrape_menu, ScrapeResult
from services.llm_extraction_service import extract_menu_from_text
from services.embedding_service import get_embeddings_batch, make_item_text
from services.search_fallback import find_menu_candidates

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])

MENU_CACHE_DAYS = 7


# ── nearby search ────────────────────────────────────────────────────────────

@router.get("/nearby", response_model=List[RestaurantOut])
def get_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(5.0),
    unit: str = Query("miles", pattern="^(miles|km)$"),
    open_only: bool = Query(False),
    price_min: Optional[int] = Query(None, ge=1, le=4),
    price_max: Optional[int] = Query(None, ge=1, le=4),
    cuisine: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    radius_m = radius_to_meters(radius, unit)

    try:
        places = search_nearby_restaurants(lat, lng, radius_m)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Places API error: {exc}")

    restaurants: List[Restaurant] = []
    for p in places:
        existing = db.query(Restaurant).filter_by(google_place_id=p["google_place_id"]).first()
        if existing:
            for k, v in p.items():
                setattr(existing, k, v)
            existing.updated_at = datetime.utcnow()
        else:
            existing = Restaurant(id=str(uuid.uuid4()), **p)
            db.add(existing)
        db.commit()
        db.refresh(existing)
        restaurants.append(existing)

    # Apply in-Python filters (small result set — fine here)
    if open_only:
        restaurants = [r for r in restaurants if r.is_open_now is True]
    if price_min is not None:
        restaurants = [r for r in restaurants if r.price_level is not None and r.price_level >= price_min]
    if price_max is not None:
        restaurants = [r for r in restaurants if r.price_level is not None and r.price_level <= price_max]
    if cuisine:
        needle = cuisine.lower()
        restaurants = [
            r for r in restaurants
            if any(needle in c.lower() for c in (r.cuisine_categories or []))
        ]

    return restaurants


# ── menu endpoints ────────────────────────────────────────────────────────────

@router.get("/{place_id}/menu", response_model=RestaurantWithMenuOut)
def get_menu(
    place_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    restaurant = db.query(Restaurant).filter_by(google_place_id=place_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Serve from cache if fresh
    if restaurant.menu_status == "available" and restaurant.menu_scraped_at:
        age = datetime.utcnow() - restaurant.menu_scraped_at
        if age < timedelta(days=MENU_CACHE_DAYS):
            return restaurant

    # Terminal states — don't retry on every request
    if restaurant.menu_status in ("unavailable", "error"):
        return restaurant

    # Restart a stale "pending" scrape (previous attempt hung and never resolved)
    if restaurant.menu_status == "pending":
        stuck = (
            restaurant.updated_at is None
            or (datetime.utcnow() - restaurant.updated_at).total_seconds() > 120
        )
        if stuck:
            restaurant.updated_at = datetime.utcnow()
            db.commit()
            background_tasks.add_task(_run_scrape, restaurant.id)
        return restaurant

    # Kick off a fresh scrape (status is "none" or stale "available").
    # Even with no website_url, the search fallback can usually find the menu
    # for well-known chains via Yelp / UberEats / DoorDash listings.
    restaurant.menu_status = "pending"
    restaurant.updated_at = datetime.utcnow()
    db.commit()
    background_tasks.add_task(_run_scrape, restaurant.id)

    return restaurant


@router.get("/{place_id}/menu/status", response_model=MenuStatusOut)
def get_menu_status(place_id: str, db: Session = Depends(get_db)):
    restaurant = db.query(Restaurant).filter_by(google_place_id=place_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return {"status": restaurant.menu_status, "restaurant_id": restaurant.id}


# ── background task ───────────────────────────────────────────────────────────

def _call_with_timeout(fn, timeout, *args):
    """Run fn(*args) in a thread, raise TimeoutError if it exceeds timeout seconds."""
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = executor.submit(fn, *args)
    executor.shutdown(wait=False)
    return future.result(timeout=timeout)


def _try_one_source(url: str, timeout_s: int = 60) -> Optional[dict]:
    """Scrape a single URL and return a structured menu dict (or None)."""
    try:
        result: ScrapeResult = _call_with_timeout(scrape_menu, timeout_s, url)
    except concurrent.futures.TimeoutError:
        log.info(f"[scrape]   timed out: {url}")
        return None
    except Exception as exc:
        log.info(f"[scrape]   error fetching {url}: {exc}")
        return None

    log.info(f"[scrape]   source={result.source} structured={result.structured is not None} text_len={len(result.text or '')}")

    if result.structured:
        return result.structured
    if result.text:
        try:
            return _call_with_timeout(extract_menu_from_text, 30, result.text)
        except concurrent.futures.TimeoutError:
            log.info(f"[scrape]   LLM/heuristic timed out on {url}")
            return None
    return None


def _run_scrape(restaurant_id: str):
    """Background task: scrape + parse a menu for a restaurant.

    Strategy:
      1. Primary website: JSON-LD → text → LLM/heuristic
      2. If nothing usable, search the web for "[restaurant] [city] menu" and
         try the top aggregator results (DoorDash, Grubhub, Yelp, etc.).
    """
    db = SessionLocal()
    try:
        restaurant = db.query(Restaurant).filter_by(id=restaurant_id).first()
        if not restaurant:
            return

        log.info(f"[scrape] starting: {restaurant.name} -> {restaurant.website_url or '(no website — search fallback only)'}")

        menu_data: Optional[dict] = None

        # 1. Try the restaurant's own website if we have one
        if restaurant.website_url:
            menu_data = _try_one_source(restaurant.website_url)

        # 2. Otherwise (or if primary failed) search the web for menu listings —
        #    works well for chains where Places doesn't return a per-location site
        if not menu_data:
            log.info(f"[scrape] {'no primary website' if not restaurant.website_url else 'primary failed'} for {restaurant.name}; trying web search fallback")
            try:
                candidates = _call_with_timeout(
                    find_menu_candidates,
                    15,
                    restaurant.name,
                    restaurant.address,
                    restaurant.website_url,
                    5,
                )
            except Exception as exc:
                log.info(f"[scrape] search fallback failed: {exc}")
                candidates = []

            for cand in candidates:
                log.info(f"[scrape] trying fallback: {cand}")
                menu_data = _try_one_source(cand, timeout_s=45)
                if menu_data and menu_data.get("sections"):
                    log.info(f"[scrape] fallback succeeded via {cand}")
                    break

        if not menu_data or not menu_data.get("sections"):
            log.info(f"[scrape] no menu found for {restaurant.name}; marking unavailable")
            restaurant.menu_status = "unavailable"
            db.commit()
            return

        # Replace existing menu
        db.query(MenuSection).filter_by(restaurant_id=restaurant.id).delete()
        db.commit()

        # Build sections and collect all items before touching the DB
        pending_items: list[MenuItem] = []
        for order, sec in enumerate(menu_data.get("sections", [])):
            section = MenuSection(
                id=str(uuid.uuid4()),
                restaurant_id=restaurant.id,
                name=sec.get("name", ""),
                food_category=sec.get("food_category", "Other"),
                display_order=order,
            )
            db.add(section)
            db.flush()

            for item in sec.get("items", []):
                pending_items.append(MenuItem(
                    id=str(uuid.uuid4()),
                    restaurant_id=restaurant.id,
                    section_id=section.id,
                    name=item.get("name", ""),
                    description=item.get("description"),
                    price=item.get("price"),
                    price_min=item.get("price_min"),
                    price_max=item.get("price_max"),
                    raw_price_text=item.get("raw_price_text"),
                    food_category=sec.get("food_category", "Other"),
                    dietary_flags=item.get("dietary_flags", []),
                ))

        # Batch-embed all items in a single API call
        log.info(f"[scrape] embedding {len(pending_items)} items...")
        try:
            texts = [make_item_text(m.name, m.description, m.food_category) for m in pending_items]
            embeddings = get_embeddings_batch(texts)
            for item, emb in zip(pending_items, embeddings):
                item.embedding = emb
        except Exception as emb_err:
            log.info(f"[scrape] embedding failed (items saved without embeddings): {emb_err}")

        for item in pending_items:
            db.add(item)

        restaurant.menu_status = "available"
        restaurant.menu_scraped_at = datetime.utcnow()
        restaurant.updated_at = datetime.utcnow()
        db.commit()
        log.info(f"[scrape] done for {restaurant.name}")

    except Exception as exc:
        log.exception(f"[scrape] error for {restaurant_id}: {exc}")
        try:
            restaurant = db.query(Restaurant).filter_by(id=restaurant_id).first()
            if restaurant:
                restaurant.menu_status = "error"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
