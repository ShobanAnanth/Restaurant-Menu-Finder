from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import MenuItem, Restaurant
from schemas import MenuItemWithRestaurantOut
from services.embedding_service import get_embedding, rank_by_similarity

router = APIRouter(prefix="/api/menu-items", tags=["menu-items"])

SEMANTIC_THRESHOLD = 0.25  # minimum cosine to include a semantic match
MAX_RESULTS = 200


def _to_out(item: MenuItem) -> MenuItemWithRestaurantOut:
    return MenuItemWithRestaurantOut(
        id=item.id,
        name=item.name,
        description=item.description,
        price=item.price,
        price_min=item.price_min,
        price_max=item.price_max,
        raw_price_text=item.raw_price_text,
        food_category=item.food_category,
        dietary_flags=item.dietary_flags or [],
        restaurant_id=item.restaurant_id,
        restaurant_name=item.restaurant.name if item.restaurant else "",
        google_place_id=item.restaurant.google_place_id if item.restaurant else "",
        is_open_now=item.restaurant.is_open_now if item.restaurant else None,
        price_level=item.restaurant.price_level if item.restaurant else None,
    )


@router.get("/search", response_model=List[MenuItemWithRestaurantOut])
def search_menu_items(
    q: Optional[str] = Query(None, description="Free-text query (semantic if embeddings available, otherwise keyword)"),
    category: Optional[str] = Query(None),
    price_min: Optional[float] = Query(None),
    price_max: Optional[float] = Query(None),
    open_only: bool = Query(False),
    restaurant_price_min: Optional[int] = Query(None, ge=1, le=4),
    restaurant_price_max: Optional[int] = Query(None, ge=1, le=4),
    db: Session = Depends(get_db),
):
    base = (
        db.query(MenuItem)
        .join(Restaurant, MenuItem.restaurant_id == Restaurant.id)
        .filter(Restaurant.menu_status == "available")
    )

    if category:
        base = base.filter(MenuItem.food_category.ilike(f"%{category}%"))
    if price_min is not None:
        base = base.filter(MenuItem.price >= price_min)
    if price_max is not None:
        base = base.filter(MenuItem.price <= price_max)
    if open_only:
        base = base.filter(Restaurant.is_open_now.is_(True))
    if restaurant_price_min is not None:
        base = base.filter(Restaurant.price_level >= restaurant_price_min)
    if restaurant_price_max is not None:
        base = base.filter(Restaurant.price_level <= restaurant_price_max)

    if not q or not q.strip():
        items = base.order_by(MenuItem.food_category, MenuItem.price).limit(MAX_RESULTS).all()
        return [_to_out(it) for it in items]

    query = q.strip()
    candidates = base.all()
    if not candidates:
        return []

    # Try semantic search if we have embeddings available
    embedded = [it for it in candidates if it.embedding]
    query_vec = get_embedding(query) if embedded else None

    if query_vec and embedded:
        item_vecs = [it.embedding for it in embedded]
        scores = rank_by_similarity(query_vec, item_vecs)
        scored = [(s, it) for s, it in zip(scores, embedded) if s >= SEMANTIC_THRESHOLD]
        scored.sort(key=lambda x: x[0], reverse=True)
        ranked = [it for _, it in scored[:MAX_RESULTS]]
        # Also include keyword matches from un-embedded items as a safety net
        unembedded_kw = _keyword_filter(query, [it for it in candidates if not it.embedding])
        # de-duplicate preserving order
        seen = {it.id for it in ranked}
        for it in unembedded_kw:
            if it.id not in seen:
                ranked.append(it)
        return [_to_out(it) for it in ranked[:MAX_RESULTS]]

    # Keyword fallback (no embeddings available at all)
    matches = _keyword_filter(query, candidates)
    return [_to_out(it) for it in matches[:MAX_RESULTS]]


def _keyword_filter(query: str, items: List[MenuItem]) -> List[MenuItem]:
    """Case-insensitive substring match across name + description, ranked by name-hit > desc-hit > category-hit."""
    needles = [t for t in query.lower().split() if t]
    if not needles:
        return []
    ranked = []
    for it in items:
        name = (it.name or "").lower()
        desc = (it.description or "").lower()
        cat = (it.food_category or "").lower()
        score = 0
        for n in needles:
            if n in name:
                score += 3
            if n in desc:
                score += 2
            if n in cat:
                score += 1
        if score > 0:
            ranked.append((score, it))
    ranked.sort(key=lambda x: x[0], reverse=True)
    return [it for _, it in ranked]


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(MenuItem.food_category)
        .filter(MenuItem.food_category.isnot(None))
        .distinct()
        .all()
    )
    return sorted(r[0] for r in rows if r[0])
