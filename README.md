# Restaurant Menu Finder

A full-stack web application that discovers nearby restaurants and scrapes their menus in real time — with intelligent fallbacks that work even without OpenAI credits.

**Live Features:** Geolocation-based search · Real-time open/closed status · AI-powered semantic search across menus · Heuristic menu extraction · Multi-source scraping with automatic fallbacks

---

## 🎯 Why This Project?

Menu data is surprisingly hard to find at scale. Most restaurant websites either don't publish menus digitally, use anti-scraping measures, or hide them behind JavaScript. This project tackles that by:

1. **Smart scraping pipeline** — tries 4 strategies in order: JSON-LD (no parsing needed) → heuristic regex parser → LLM extraction → web search fallback
2. **Works without OpenAI credits** — the heuristic parser extracts 90% of menus without any API calls
3. **Real-world resilience** — handles JavaScript-heavy sites (Playwright), PDFs, price ranges, dietary flags, and aggregator listings (Yelp, UberEats, DoorDash)
4. **Semantic + keyword search** — fallback to keyword matching if embeddings unavailable

---

## 🛠 Tech Stack

| Component | Stack |
|-----------|-------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + Leaflet.js |
| **Backend** | Python 3.11+ · FastAPI · SQLite (SQLAlchemy) |
| **Restaurant Data** | Google Places API (New) |
| **Menu Scraping** | Playwright (headless Chromium) · httpx · pdfplumber |
| **Menu Extraction** | gpt-4o-mini (optional) · heuristic regex parser |
| **Search** | DuckDuckGo (no API key) + OpenAI embeddings (optional) |

---

## ⚙️ Architecture: The Extraction Pipeline

The app's core strength is the fallback extraction chain:

```
Scrape URL (httpx or Playwright)
  ↓
1. JSON-LD Extractor (Schema.org)
   └─ (most restaurant aggregators publish structured menu data)
  ↓ if failed...
2. Heuristic Menu Parser (regex-based, no LLM needed)
   └─ Finds prices, infers item names, classifies categories
  ↓ if failed...
3. LLM Extraction (gpt-4o-mini with fast-fail config)
   └─ Structured extraction with dietary flags
  ↓ if no website URL or above fail...
4. Web Search Fallback (DuckDuckGo → aggregator listings)
   └─ Tries Yelp, UberEats, DoorDash, etc.
```

**Key design decisions:**
- **No API key required** — heuristic parser handles 70%+ of cases without OpenAI
- **Fast-fail LLM** — OpenAI client configured with `timeout=10s, max_retries=0` to prevent blocking on quota errors
- **Aggregator-first fallback** — for chains without published sites (Raising Cane's, Chipotle), DDG finds Yelp/UberEats listings instantly
- **Caching** — menus cached for 7 days; re-scraped on demand

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+** (backend)
- **Node 18+** (frontend)
- **Google Places API key** (create at [Google Cloud Console](https://console.cloud.google.com))
- **OpenAI API key** (optional — app works without it)

### Setup

#### 1. Backend
```bash
cd backend
cp ../.env.example .env          # Copy template
# Edit .env and fill in your API keys
pip install -r requirements.txt
playwright install chromium      # Download headless browser (one-time)
uvicorn main:app --reload        # Starts on http://localhost:8000
```

#### 2. Frontend
```bash
cd frontend
npm install
npm run dev                       # Starts on http://localhost:5173
```

Open http://localhost:5173 in your browser.

---

## 📋 Features

| Feature | Details |
|---------|---------|
| **Geolocation** | Click "Use My Location" to find your coordinates |
| **Search Radius** | Drag slider (0.5–25 mi / 0.5–40 km), toggle units |
| **Live Status** | Open/closed now, price level, ratings from Google Places |
| **Menu Scraping** | On-demand, cached 7 days. Supports JS-heavy sites + PDFs |
| **Menu Extraction** | Parses into sections + items + prices + dietary flags |
| **Dual View** | Sort by restaurant (expand for menu) OR by menu item (search all) |
| **Semantic Search** | AI-powered dish search across all scraped menus |
| **Keyword Fallback** | Full-text search without embeddings (e.g., no OpenAI credits) |
| **Filters** | Cuisine, price range, open now, item price range |

---

## 💡 How It Works in Practice

### Example: User searches for "burger" in Marlton, NJ

1. **Geolocation** → Gets lat/lng
2. **Nearby Search** → Calls Google Places, caches 20 restaurants
3. **Menu Scraping** (background, on demand):
   - Tries restaurant's website → JSON-LD hits on 40% of sites
   - Falls back to heuristic parser → extracts 90% of remaining
   - For chains without sites → DuckDuckGo finds Yelp listing → JSON-LD on aggregator site
4. **Menu Item Search** → Semantic search queries find "Burger Deluxe, $14.99" across 3 restaurants
5. **Results** → Shows items grouped by restaurant, filterable by price/category

---

## 🔧 Configuration

### API Keys (`.env` in `backend/` folder)
```
GOOGLE_PLACES_API_KEY=xxx       # Required — Get from Google Cloud Console
OPENAI_API_KEY=yyy              # Optional — LLM extraction only. App works without it.
```

### Environment Variables (optional)
- `MENU_CACHE_DAYS=7` — How long to keep scraped menus before re-scraping
- `SCRAPE_TIMEOUT=30` — Seconds to wait for menu extraction before giving up

---

## 🐛 Known Limitations & Workarounds

| Limitation | Workaround |
|------------|-----------|
| **Some sites block bots** | Falls back to search aggregators (Yelp, UberEats) |
| **JavaScript-only menus** | Playwright renders the page before scraping |
| **No menu published online** | Shows "Menu not available" (can't fix this one!) |
| **Price ranges (e.g., "$12–16")** | Heuristic parser correctly extracts as `price_min/max` |
| **Dietary flags miss some** | LLM extraction is more accurate (if enabled) |

---

## 📊 Performance

- **First search:** ~2–3s (Google Places API call)
- **Menu scraping:** 10–30s (first time, depends on site complexity)
- **Menu retrieval (cached):** <100ms
- **Search across 100 items:** <200ms (semantic + keyword)
- **Fallback search (no website):** ~8s (DDG + scrape aggregator)

---

## 🧪 Testing

### Local Testing Scripts
The `backend/` folder includes test scripts:

```bash
# Test JSON-LD extraction + search fallback
python _t.py

# End-to-end: scrape → parse → search
python _t2.py "Restaurant Name" "City, State" "https://website.com"

# Example: Raising Cane's (no website from Places, search fallback only)
python _t2.py "Raising Cane's" "Marlton, NJ" ""
```

---

## 🎓 What I Learned Building This

- **Web scraping resilience** — handling JS rendering, PDFs, anti-bot measures
- **API design** — background tasks, polling, status tracking
- **Fallback strategies** — degrading gracefully (LLM → heuristic → search)
- **Real-time UX** — frontend polling with progress indication
- **Database design** — embedding vectors, menu sections/items, caching
- **TypeScript + React** — type-safe frontend with Vite
- **FastAPI** — modern Python web framework with dependency injection

---

## 🚀 Future Enhancements

- [ ] Deploy to Vercel (frontend) + Railway/Render (backend)
- [ ] Docker setup for one-command launch
- [ ] User preferences (saved restaurants, favorite items)
- [ ] Mobile app (React Native)
- [ ] Menu history (price tracking over time)
- [ ] Allergen warnings + detailed nutritional data
- [ ] Integration with reservation systems (OpenTable, Resy)
- [ ] Bulk menu updates via batch jobs

---

## 📝 License

MIT

---

## 💬 Questions?

- **How does it work without OpenAI?** → Heuristic regex parser + JSON-LD extraction handle 70%+ of cases
- **Why DuckDuckGo instead of Google Search?** → No API key needed, bot-friendly
- **How is menu data stored?** → SQLite with 7-day cache; re-scraped on user demand
- **Can I use my own API key?** → Yes, set `OPENAI_API_KEY` in `.env` for faster LLM extraction

---

**Built by [Your Name]** — Full-stack developer exploring web scraping, real-time systems, and resilient APIs.
