"""
Scrape menu data from a restaurant website.

Strategy (cheapest → most expensive):
  1. httpx GET on the URL (and a discovered /menu sub-page)
     a. Look for Schema.org JSON-LD menu data — if found, return it structured
     b. Otherwise extract text and check if it "looks like" a menu
  2. Playwright (headless Chromium) for JS-rendered sites — same JSON-LD/text logic
  3. PDF detection at each step

The function returns a `ScrapeResult` carrying either structured menu data
(no LLM/heuristic needed) or raw text (passed downstream for parsing).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse, urljoin

import httpx

from services.jsonld_menu_extractor import extract_from_html as extract_jsonld

MENU_KEYWORDS = ["menu", "our-menu", "food", "eat", "dine", "order"]
_COMMON_MENU_PATHS = ["/menu", "/our-menu", "/food", "/menus", "/food-menu"]

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

MAX_CHARS = 12_000


@dataclass
class ScrapeResult:
    structured: Optional[Dict[str, Any]] = None  # Menu dict from JSON-LD (no further parsing needed)
    text: Optional[str] = None                   # Raw text (needs LLM/heuristic)
    source: str = ""                             # URL or reason marker for logging


def scrape_menu(website_url: str) -> ScrapeResult:
    """Main entry point. Returns a ScrapeResult with either structured menu or raw text."""
    # ---- 1. Fast httpx path ----
    fast = _try_httpx(website_url)
    if fast.structured:
        return fast
    if fast.text and _looks_like_menu(fast.text):
        return fast

    # ---- 2. Slow Playwright path ----
    slow = _try_playwright(website_url)
    if slow.structured:
        return slow
    if slow.text:
        return slow

    # ---- 3. Fall back to whatever the fast path got, even if uncertain ----
    if fast.text:
        return fast

    return ScrapeResult(source=slow.source or fast.source or "no content")


# ───────────────────────── httpx (fast) ─────────────────────────────────────

def _try_httpx(url: str) -> ScrapeResult:
    try:
        with httpx.Client(timeout=10, headers=_HEADERS, follow_redirects=True) as client:
            return _httpx_fetch_and_extract(client, url)
    except Exception as exc:
        return ScrapeResult(source=f"httpx failed: {exc}")


def _httpx_fetch_and_extract(client: httpx.Client, url: str) -> ScrapeResult:
    resp = client.get(url)
    resp.raise_for_status()
    html = resp.text

    # JSON-LD on the landing page
    structured = extract_jsonld(html)
    if structured:
        return ScrapeResult(structured=structured, source=f"jsonld:{url}")

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")

    # PDF check
    pdf = _find_pdf_in_html(soup, url)
    if pdf:
        pdf_text = _extract_pdf(pdf)
        if pdf_text:
            return ScrapeResult(text=pdf_text[:MAX_CHARS], source=f"pdf:{pdf}")

    # Try a menu sub-page
    menu_url = _find_menu_link_in_html(soup, url)
    if menu_url and menu_url.rstrip("/") != url.rstrip("/"):
        try:
            resp2 = client.get(menu_url)
            resp2.raise_for_status()
            html2 = resp2.text
            structured2 = extract_jsonld(html2)
            if structured2:
                return ScrapeResult(structured=structured2, source=f"jsonld:{menu_url}")
            soup = BeautifulSoup(html2, "html.parser")
            # PDF on the menu sub-page
            pdf2 = _find_pdf_in_html(soup, menu_url)
            if pdf2:
                pdf_text = _extract_pdf(pdf2)
                if pdf_text:
                    return ScrapeResult(text=pdf_text[:MAX_CHARS], source=f"pdf:{pdf2}")
            url = menu_url
        except Exception:
            pass

    text = soup.get_text(separator="\n", strip=True)
    return ScrapeResult(text=text[:MAX_CHARS] if text else None, source=url)


# ───────────────────────── playwright (slow) ────────────────────────────────

def _try_playwright(url: str) -> ScrapeResult:
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    except ImportError:
        return ScrapeResult(source="playwright not installed")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=_HEADERS["User-Agent"], java_script_enabled=True)
            page = ctx.new_page()
            page.set_default_timeout(15_000)

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                page.wait_for_timeout(2_000)
            except PWTimeout:
                pass

            # Pull the rendered HTML and check JSON-LD
            try:
                html = page.content()
                structured = extract_jsonld(html)
                if structured:
                    browser.close()
                    return ScrapeResult(structured=structured, source=f"jsonld:{url}")
            except Exception:
                pass

            # PDF check
            pdf_url = _find_pdf_in_page(page)
            if pdf_url:
                pdf_text = _extract_pdf(pdf_url)
                if pdf_text:
                    browser.close()
                    return ScrapeResult(text=pdf_text[:MAX_CHARS], source=f"pdf:{pdf_url}")

            # Try menu sub-page
            menu_url = _find_menu_link_in_page(page, url)
            if menu_url and menu_url.rstrip("/") != url.rstrip("/"):
                try:
                    page.goto(menu_url, wait_until="domcontentloaded", timeout=12_000)
                    page.wait_for_timeout(2_000)
                    url = menu_url
                    html2 = page.content()
                    structured2 = extract_jsonld(html2)
                    if structured2:
                        browser.close()
                        return ScrapeResult(structured=structured2, source=f"jsonld:{menu_url}")
                except PWTimeout:
                    pass

            pdf_url = _find_pdf_in_page(page)
            if pdf_url:
                pdf_text = _extract_pdf(pdf_url)
                if pdf_text:
                    browser.close()
                    return ScrapeResult(text=pdf_text[:MAX_CHARS], source=f"pdf:{pdf_url}")

            text: str = page.evaluate("() => document.body.innerText") or ""
            browser.close()
            if text:
                return ScrapeResult(text=text[:MAX_CHARS], source=url)
            return ScrapeResult(source="no page content")

    except Exception as exc:
        return ScrapeResult(source=f"playwright error: {exc}")


# ───────────────────────── helpers ──────────────────────────────────────────

def _find_menu_link_in_html(soup, base_url: str) -> Optional[str]:
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        text = a.get_text().lower().strip()
        if href.startswith("javascript") or href.startswith("mailto"):
            continue
        if any(kw in text or kw in href.lower() for kw in MENU_KEYWORDS):
            return urljoin(base_url, href)
    parsed = urlparse(base_url)
    return f"{parsed.scheme}://{parsed.netloc}{_COMMON_MENU_PATHS[0]}"


def _find_menu_link_in_page(page, base_url: str) -> Optional[str]:
    try:
        links = page.evaluate(
            "() => Array.from(document.querySelectorAll('a'))"
            ".map(a => ({href: a.href, text: a.innerText}))"
        )
        for link in links:
            href = (link.get("href") or "").strip()
            text = (link.get("text") or "").lower().strip()
            if not href or href.startswith("javascript") or href.startswith("mailto"):
                continue
            if any(kw in text or kw in href.lower() for kw in MENU_KEYWORDS):
                return href
    except Exception:
        pass
    parsed = urlparse(base_url)
    return f"{parsed.scheme}://{parsed.netloc}{_COMMON_MENU_PATHS[0]}"


def _find_pdf_in_html(soup, base_url: str) -> Optional[str]:
    for a in soup.find_all("a", href=True):
        if a["href"].lower().endswith(".pdf"):
            return urljoin(base_url, a["href"])
    return None


def _find_pdf_in_page(page) -> Optional[str]:
    try:
        hrefs = page.evaluate("() => Array.from(document.querySelectorAll('a')).map(a => a.href)")
        for href in hrefs:
            if href and href.lower().endswith(".pdf"):
                return href
    except Exception:
        pass
    return None


def _extract_pdf(pdf_url: str) -> Optional[str]:
    try:
        import pdfplumber
        with httpx.Client(timeout=15, headers=_HEADERS) as client:
            resp = client.get(pdf_url)
            resp.raise_for_status()
        buf = io.BytesIO(resp.content)
        parts = []
        with pdfplumber.open(buf) as pdf:
            for pg in pdf.pages[:12]:
                t = pg.extract_text()
                if t:
                    parts.append(t)
        return "\n".join(parts) if parts else None
    except Exception:
        return None


def _looks_like_menu(text: str) -> bool:
    lower = text.lower()
    has_price = bool(re.search(r"\$\s*\d+", text))
    word_count = len(text.split())
    food_hits = sum(
        1 for w in [
            "burger", "steak", "chicken", "salad", "pasta", "pizza", "soup",
            "sandwich", "appetizer", "entree", "dessert", "beverage",
            "grilled", "fried", "baked", "roasted", "wrap", "taco",
            "tofu", "noodle", "rice", "curry", "sushi", "ramen", "bowl",
        ]
        if w in lower
    )
    return (has_price and word_count > 60) or food_hits >= 3


# ───────────────────────── backwards-compatible shim ────────────────────────

def scrape_menu_text(website_url: str) -> Tuple[Optional[str], str]:
    """Legacy text-only entry point (kept for any external callers/tests)."""
    r = scrape_menu(website_url)
    return r.text, r.source
