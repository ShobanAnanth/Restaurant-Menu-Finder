"""
Extract structured menu data from raw text.
Tries OpenAI gpt-4o-mini first; falls back to a heuristic parser if the LLM
is unavailable, out of quota, or returns nothing.
"""

import json
import os
from typing import Any, Dict, Optional

from services.heuristic_menu_parser import parse_menu as heuristic_parse_menu

FOOD_CATEGORIES = [
    "Burgers", "Steaks", "Pizza", "Pasta", "Salads", "Sandwiches",
    "Seafood", "Sushi", "Mexican", "Chicken", "Appetizers",
    "Soups", "Desserts", "Drinks", "Breakfast", "Vegetarian", "Other",
]

_SYSTEM_PROMPT = (
    "You are a menu data extraction assistant. "
    "Extract structured menu information from restaurant menu text and return ONLY valid JSON. "
    "No explanation, no markdown — raw JSON only."
)

_USER_PROMPT_TEMPLATE = """\
Extract the menu from the text below and return this exact JSON structure:

{{
  "menu_found": true,
  "sections": [
    {{
      "name": "section name",
      "food_category": "<one of: {categories}>",
      "items": [
        {{
          "name": "item name",
          "description": "description or null",
          "price": 12.99,
          "price_min": null,
          "price_max": null,
          "raw_price_text": "$12.99",
          "dietary_flags": []
        }}
      ]
    }}
  ]
}}

Rules:
- Set menu_found to false if no menu content is present.
- price must be a float or null. For ranges like "$12–16" set price_min/price_max and leave price null.
- dietary_flags: only use values from [vegetarian, vegan, gluten-free, dairy-free, nut-free].
- food_category must be exactly one of: {categories}

Menu text:
{text}
"""


def _try_llm(menu_text: str) -> Optional[Dict[str, Any]]:
    """Try to extract menu via OpenAI. Returns None on any failure."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    # Fail fast on auth/quota errors so the heuristic fallback gets a chance
    # to run within the outer scrape timeout.
    client = OpenAI(api_key=api_key, timeout=10.0, max_retries=0)
    prompt = _USER_PROMPT_TEMPLATE.format(
        categories=", ".join(FOOD_CATEGORIES),
        text=menu_text[:12_000],
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        if not data.get("menu_found", False):
            return None
        return data
    except Exception as exc:
        print(f"[LLM] extraction failed (will try heuristic): {exc}", flush=True)
        return None


def extract_menu_from_text(menu_text: str) -> Optional[Dict[str, Any]]:
    """
    Extract a structured menu from raw text.
    Tries the LLM first; on any failure (quota, network, no key), falls back
    to the heuristic parser. Returns None only if neither produces output.
    """
    if not menu_text or not menu_text.strip():
        return None

    data = _try_llm(menu_text)
    if data and data.get("sections"):
        return data

    fallback = heuristic_parse_menu(menu_text)
    if fallback:
        print(f"[menu] using heuristic parser ({sum(len(s['items']) for s in fallback['sections'])} items)", flush=True)
    return fallback
