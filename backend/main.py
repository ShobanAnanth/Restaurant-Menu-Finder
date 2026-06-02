import sys
import logging
# Force UTF-8 stdio so unicode prints (arrows, em-dashes, etc.) never crash on Windows
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Surface our scrape logs through uvicorn's stderr
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

from dotenv import load_dotenv
load_dotenv()

import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from sqlalchemy import text
from database import Base, engine
from routes import restaurants, menus

# Create tables on startup
Base.metadata.create_all(bind=engine)

# Add new columns to existing DBs
with engine.connect() as _conn:
    try:
        _conn.execute(text("ALTER TABLE menu_items ADD COLUMN embedding JSON"))
        _conn.commit()
    except Exception:
        pass  # column already exists
    try:
        _conn.execute(text("ALTER TABLE restaurants ADD COLUMN photo_url TEXT"))
        _conn.commit()
    except Exception:
        pass  # column already exists

app = FastAPI(title="Restaurant Menu Finder API", version="1.0.0")

# Allow extra origins via env var (comma-separated). Always allow localhost dev.
_default_origins = ["http://localhost:5173", "http://localhost:3000"]
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
# In production set CORS_ORIGINS to your deployed frontend origin(s), e.g.
#   CORS_ORIGINS=https://my-app.vercel.app
# or use "*" for fully open access.
_origins = _default_origins + _extra_origins or _default_origins
_allow_all = "*" in _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _origins,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants.router)
app.include_router(menus.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/photos/{photo_ref:path}")
def proxy_photo(photo_ref: str, max_height_px: int = 400):
    """Proxy Google Places photo bytes so the API key never reaches the browser."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Places API key not configured")
    # photo_ref looks like "places/<place_id>/photos/<photo_id>"
    if not photo_ref.startswith("places/") or "/photos/" not in photo_ref:
        raise HTTPException(status_code=400, detail="Invalid photo reference")
    upstream = f"https://places.googleapis.com/v1/{photo_ref}/media"
    params = {"key": api_key, "max_height_px": max(1, min(max_height_px, 1600))}
    try:
        with httpx.Client(timeout=10, follow_redirects=True) as client:
            resp = client.get(upstream, params=params)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream photo fetch failed: {exc}")
    content_type = resp.headers.get("content-type", "image/jpeg")
    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
