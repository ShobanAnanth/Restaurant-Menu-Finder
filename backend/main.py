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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants.router)
app.include_router(menus.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
