"""
Extract structured menu data from Schema.org JSON-LD embedded in a page.

Many restaurant sites (especially those on WordPress/Squarespace/Wix/BentoBox,
plus aggregators like DoorDash/Grubhub/Yelp) embed their menu data as JSON-LD:

    <script type="application/ld+json">
      { "@type": "Restaurant",
        "hasMenu": { "@type": "Menu",
          "hasMenuSection": [ ... { "hasMenuItem": [ ... ] } ... ] } }
    </script>

Some variants put the menu directly on the Menu node (no sections), use
@graph arrays, nest Restaurants inside WebPage, etc. This module handles
the common shapes and returns the same dict shape as the LLM/heuristic
extractors so the rest of the pipeline can stay unchanged.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Optional

FOOD_CATEGORIES = [
    "Burgers", "Steaks", "Pizza", "Pasta", "Salads", "Sandwiches",
    "Seafood", "Sushi", "Mexican", "Chicken", "Appetizers",
    "Soups", "Desserts", "Drinks", "Breakfast", "Vegetarian", "Other",
]

CAT_KEYWORDS = {
    "Pizza":       ["pizza", "margherita", "pepperoni", "calzone", "stromboli"],
    "Burgers":     ["burger", "cheeseburger"],
    "Steaks":      ["steak", "ribeye", "filet", "sirloin", "porterhouse"],
    "Pasta":       ["pasta", "spaghetti", "linguine", "fettuccine", "lasagna", "ravioli", "penne", "rigatoni", "carbonara", "alfredo"],
    "Salads":      ["salad", "caesar", "cobb"],
    "Sandwiches":  ["sandwich", "hoagie", "panini", "sub", "wrap", "club"],
    "Seafood":     ["salmon", "tuna", "shrimp", "lobster", "crab", "calamari", "oyster", "scallop", "tilapia", "swordfish", "cod", "mussel", "clam"],
    "Sushi":       ["sushi", "sashimi", "maki", "nigiri", "tempura"],
    "Mexican":     ["taco", "burrito", "quesadilla", "enchilada", "fajita", "nachos"],
    "Chicken":     ["chicken", "wings", "tender", "drumstick"],
    "Appetizers":  ["appetizer", "starter", "antipasto", "fries", "mozzarella stick", "dip"],
    "Soups":       ["soup", "chowder", "bisque", "broth", "minestrone"],
    "Desserts":    ["dessert", "cake", "tiramisu", "cheesecake", "ice cream", "gelato", "pudding", "brownie", "cookie", "cannoli", "pie"],
    "Drinks":      ["coffee", "espresso", "latte", "tea", "soda", "juice", "lemonade", "smoothie", "beer", "wine", "cocktail", "vodka", "whiskey", "tequila", "rum", "ale", "ipa", "lager"],
    "Breakfast":   ["pancake", "waffle", "omelette", "omelet", "egg", "bacon", "breakfast", "french toast"],
    "Vegetarian":  ["vegan", "vegetarian", "tofu"],
}

DIETARY_KEYWORDS = {
    "vegetarian": ["vegetarian", "veggie"],
    "vegan": ["vegan"],
    "gluten-free": ["gluten-free", "gluten free", "(gf)"],
    "dairy-free": ["dairy-free", "dairy free"],
    "nut-free": ["nut-free", "nut free"],
}

_JSONLD_RE = re.compile(
    r"<script[^>]*type\s*=\s*[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.DOTALL | re.IGNORECASE,
)


def _classify(name: str, description: Optional[str]) -> str:
    blob = (name + " " + (description or "")).lower()
    for cat, kws in CAT_KEYWORDS.items():
        if any(k in blob for k in kws):
            return cat
    return "Other"


def _dietary(text: str) -> List[str]:
    lower = (text or "").lower()
    return [tag for tag, kws in DIETARY_KEYWORDS.items() if any(k in lower for k in kws)]


def _to_list(x: Any) -> List[Any]:
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def _type_matches(obj: Any, target: str) -> bool:
    """Schema.org @type can be a string or list (multi-typed)."""
    if not isinstance(obj, dict):
        return False
    t = obj.get("@type") or obj.get("type")
    if isinstance(t, str):
        return t.lower() == target.lower()
    if isinstance(t, list):
        return any(isinstance(s, str) and s.lower() == target.lower() for s in t)
    return False


def _walk(node: Any) -> Iterable[Any]:
    """Recursively yield every dict in a nested JSON structure (incl. @graph children)."""
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _walk(v)
    elif isinstance(node, list):
        for item in node:
            yield from _walk(item)


def _parse_price(offer: Any) -> Dict[str, Optional[float]]:
    """Return {price, price_min, price_max, raw_price_text} from various offer shapes."""
    out = {"price": None, "price_min": None, "price_max": None, "raw_price_text": None}
    if offer is None:
        return out
    offers = _to_list(offer)
    prices: List[float] = []
    raws: List[str] = []
    for o in offers:
        if not isinstance(o, dict):
            continue
        # Direct price
        p = o.get("price")
        if isinstance(p, (int, float)):
            prices.append(float(p))
            raws.append(f"${float(p):.2f}")
        elif isinstance(p, str):
            m = re.search(r"\d+(?:[.,]\d{1,2})?", p)
            if m:
                try:
                    prices.append(float(m.group(0).replace(",", ".")))
                    raws.append(p if "$" in p or "USD" in p.upper() else f"${prices[-1]:.2f}")
                except ValueError:
                    pass
        # PriceSpecification
        ps = o.get("priceSpecification")
        for spec in _to_list(ps):
            if not isinstance(spec, dict):
                continue
            sp = spec.get("price")
            if isinstance(sp, (int, float)):
                prices.append(float(sp))
            elif isinstance(sp, str):
                m = re.search(r"\d+(?:[.,]\d{1,2})?", sp)
                if m:
                    try:
                        prices.append(float(m.group(0).replace(",", ".")))
                    except ValueError:
                        pass

    prices = [p for p in prices if 0 < p < 500]
    if not prices:
        return out
    if len(prices) == 1 or min(prices) == max(prices):
        out["price"] = prices[0]
        out["raw_price_text"] = raws[0] if raws else f"${prices[0]:.2f}"
    else:
        lo, hi = min(prices), max(prices)
        out["price_min"] = lo
        out["price_max"] = hi
        out["raw_price_text"] = f"${lo:.2f} – ${hi:.2f}"
    return out


def _item_from_node(node: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    name = (node.get("name") or "").strip()
    if not name:
        return None
    description = (node.get("description") or "").strip() or None
    price = _parse_price(node.get("offers"))
    if price["price"] is None and price["price_min"] is None:
        return None
    flags = _dietary(name + " " + (description or ""))
    # Suitable-for-diet hints
    for d in _to_list(node.get("suitableForDiet")):
        if isinstance(d, str):
            ds = d.lower()
            if "vegan" in ds and "vegan" not in flags:
                flags.append("vegan")
            elif "vegetarian" in ds and "vegetarian" not in flags:
                flags.append("vegetarian")
            elif "glutenfree" in ds.replace(" ", "").replace("-", "") and "gluten-free" not in flags:
                flags.append("gluten-free")

    return {
        "name": name[:100],
        "description": description,
        **price,
        "dietary_flags": flags,
        "_cat": _classify(name, description),
    }


def _extract_from_menu_node(menu: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Pull sections (with items) out of a Menu / MenuSection node."""
    sections: List[Dict[str, Any]] = []

    # If this node itself has hasMenuItem (no sub-sections), treat as one big section
    direct_items = [
        i for n in _to_list(menu.get("hasMenuItem"))
        for i in [_item_from_node(n)] if i
    ]

    for sec_node in _to_list(menu.get("hasMenuSection")):
        if not isinstance(sec_node, dict):
            continue
        # MenuSections can nest inside MenuSections
        sub = _extract_from_menu_node(sec_node)
        if sub:
            sections.extend(sub)
            continue
        items: List[Dict[str, Any]] = []
        for it_node in _to_list(sec_node.get("hasMenuItem")):
            if isinstance(it_node, dict):
                it = _item_from_node(it_node)
                if it:
                    items.append(it)
        if items:
            sections.append({
                "name": (sec_node.get("name") or "Menu").strip() or "Menu",
                "items": items,
            })

    if direct_items and not sections:
        sections.append({"name": menu.get("name") or "Menu", "items": direct_items})

    return sections


def extract_from_html(html: str) -> Optional[Dict[str, Any]]:
    """
    Scan an HTML document for Schema.org JSON-LD menu data.
    Returns a dict shaped like {sections: [{name, food_category, items: [...]}]} or None.
    """
    if not html or "ld+json" not in html.lower():
        return None

    raw_blocks = _JSONLD_RE.findall(html)
    if not raw_blocks:
        return None

    sections: List[Dict[str, Any]] = []
    for raw in raw_blocks:
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Some sites concatenate multiple objects or wrap them oddly — try to salvage
            try:
                data = json.loads(re.sub(r",\s*([\]}])", r"\1", raw))
            except json.JSONDecodeError:
                continue

        for node in _walk(data):
            if not isinstance(node, dict):
                continue
            # Direct Menu node
            if _type_matches(node, "Menu"):
                sections.extend(_extract_from_menu_node(node))
            # Restaurant.hasMenu can be a Menu node OR a URL string
            if _type_matches(node, "Restaurant") or _type_matches(node, "FoodEstablishment") or _type_matches(node, "FastFoodRestaurant"):
                for menu in _to_list(node.get("hasMenu")):
                    if isinstance(menu, dict):
                        sections.extend(_extract_from_menu_node(menu))
            # Some sites flatten: a MenuSection at top level
            if _type_matches(node, "MenuSection"):
                # Wrap it in a fake Menu and extract
                sub = _extract_from_menu_node({"hasMenuSection": [node]})
                sections.extend(sub)

    if not sections:
        return None

    # De-dup items across sections, classify each section
    seen: set[str] = set()
    out_sections: List[Dict[str, Any]] = []
    for sec in sections:
        deduped = []
        for it in sec["items"]:
            key = it["name"].lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(it)
        if not deduped:
            continue
        inferred = [it.pop("_cat", "Other") for it in deduped]
        food_cat = max(set(inferred), key=inferred.count) if inferred else "Other"
        out_sections.append({
            "name": sec["name"][:80],
            "food_category": food_cat,
            "items": deduped,
        })

    total = sum(len(s["items"]) for s in out_sections)
    if total < 2:
        return None

    return {"menu_found": True, "sections": out_sections}
