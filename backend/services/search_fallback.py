"""
Search-driven menu discovery.

When the restaurant's own website doesn't yield a menu (anti-bot, JS-only,
no menu published), we search the web for "[restaurant] [city] menu" and
try the top results. Aggregators we care about (DoorDash, Grubhub, Yelp,
TripAdvisor, allmenus.com, etc.) usually expose machine-readable menu data
either in JSON-LD or in plain HTML with prices.

We use DuckDuckGo's HTML endpoint because it doesn't require an API key and
isn't aggressive about blocking bot traffic. Each candidate URL is fed back
through the existing scraper pipeline, which already knows how to extract
JSON-LD or text from any HTML source.
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional
from urllib.parse import quote_plus, urlparse

import httpx

log = logging.getLogger("scrape")

# Order matters: things that publish *parseable* menu data come first.
# Yelp publishes Schema.org JSON-LD with full menus and isn't aggressive about
# blocking bots — it's the best single source we've found in testing.
PREFERRED_HOSTS = [
    "yelp.com",
    "ubereats.com",
    "singleplatform.com",
    "doordash.com",
    "grubhub.com",
    "menupages.com",
    "allmenus.com",
    "menuswithprice.com",
    "zmenu.com",
    "tripadvisor.com",
    "zomato.com",
    "seamless.com",
    "opentable.com",
    "bentobox",
]

# Hosts that almost never have real menu content
SKIP_HOSTS = {
    "facebook.com", "twitter.com", "x.com", "instagram.com", "pinterest.com",
    "youtube.com", "tiktok.com", "reddit.com", "wikipedia.org",
    "linkedin.com", "google.com", "maps.google.com", "duckduckgo.com",
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _strip_own_domain(own_url: Optional[str]) -> Optional[str]:
    if not own_url:
        return None
    try:
        host = urlparse(own_url).netloc.lower()
        return host.lstrip("www.")
    except Exception:
        return None


def _host_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return ""


def _is_useful_host(url: str, own_host: Optional[str]) -> bool:
    host = _host_of(url)
    if not host:
        return False
    if own_host and own_host in host:
        return False
    for skip in SKIP_HOSTS:
        if skip in host:
            return False
    return True


def _rank(url: str) -> int:
    host = _host_of(url)
    for i, preferred in enumerate(PREFERRED_HOSTS):
        if preferred in host:
            return i
    return len(PREFERRED_HOSTS)


def _ddg_search(query: str, max_results: int = 12) -> List[str]:
    """Use DuckDuckGo's HTML endpoint (no API key)."""
    try:
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        with httpx.Client(timeout=12, headers=_HEADERS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text
    except Exception as exc:
        log.info(f"[search] DDG fetch failed: {exc}")
        return []

    # DDG HTML wraps result links like //duckduckgo.com/l/?uddg=<encoded-target>&...
    # The ampersand is HTML-entity-encoded in the page, so we can't rely on it.
    from urllib.parse import unquote
    candidates: List[str] = []
    seen: set[str] = set()
    for m in re.finditer(r'uddg=([^"&]+?)(?:&amp;|")', html):
        target = unquote(m.group(1))
        if target.startswith("http") and target not in seen:
            seen.add(target)
            candidates.append(target)
            if len(candidates) >= max_results:
                break
    # Direct hrefs (newer DDG layouts)
    if not candidates:
        for m in re.finditer(r'class="result__a"[^>]*href="([^"]+)"', html):
            raw = m.group(1)
            # Normalize: DDG may give //host/... or /l/?uddg=...
            if raw.startswith("//"):
                raw = "https:" + raw
            if raw.startswith("https://duckduckgo.com/l/") and "uddg=" in raw:
                mm = re.search(r"uddg=([^&]+)", raw)
                if mm:
                    raw = unquote(mm.group(1))
            if raw.startswith("http") and raw not in seen:
                seen.add(raw)
                candidates.append(raw)
                if len(candidates) >= max_results:
                    break
    return candidates


def find_menu_candidates(
    name: str,
    address: Optional[str],
    own_website: Optional[str],
    limit: int = 5,
) -> List[str]:
    """Return a ranked list of external URLs that probably host this restaurant's menu."""
    locality = ""
    if address:
        # Take the second-to-last piece (city) — addresses look like
        # "123 Main St, Marlton, NJ 08053, USA"
        parts = [p.strip() for p in address.split(",")]
        if len(parts) >= 2:
            locality = parts[-3] if len(parts) >= 4 else parts[-2]

    query = f"{name} {locality} menu".strip()
    log.info(f"[search] DDG query: {query!r}")
    raw = _ddg_search(query)
    own_host = _strip_own_domain(own_website)

    filtered = [u for u in raw if _is_useful_host(u, own_host)]
    # Sort by host preference, preserving original DDG ranking within each bucket
    indexed = [(idx, u) for idx, u in enumerate(filtered)]
    indexed.sort(key=lambda t: (_rank(t[1]), t[0]))
    out = [u for _, u in indexed][:limit]
    log.info(f"[search] {len(raw)} raw, {len(filtered)} useful, top: {out[:3]}")
    return out
