"""
Heuristic (no-LLM) menu parser used as a fallback when the OpenAI API is
unavailable or out of quota.

Strategy:
 - Scan line by line for price patterns.
 - For each price, the item name is the text on the SAME line (before the
   price if there is leading text, otherwise after) or the line immediately
   above if the line is just a price.
 - Lines that look like section headers (short, no digits, Title/UPPER case)
   start a new section.
 - Each item is bucketed into a canonical food category by keyword.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# A single price token: "$12.99", "$12", "$12-16", "$12–$16", "12.99"
PRICE_RE = re.compile(
    r"""
    \$\s*
    (?P<lo>\d{1,3}(?:[.,]\d{1,2})?)
    (?:\s*[\-–—/to]+\s*\$?\s*(?P<hi>\d{1,3}(?:[.,]\d{1,2})?))?
    """,
    re.VERBOSE,
)

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "Pizza":       ["pizza", "margherita", "pepperoni", "calzone", "stromboli", "focaccia"],
    "Burgers":     ["burger", "cheeseburger", "smash"],
    "Steaks":      ["steak", "ribeye", "filet", "porterhouse", "sirloin", "new york strip"],
    "Pasta":       ["pasta", "spaghetti", "linguine", "fettuccine", "lasagna", "penne",
                    "rigatoni", "ravioli", "gnocchi", "carbonara", "alfredo", "macaroni"],
    "Salads":      ["salad", "caesar", "cobb", "greens", "kale"],
    "Sandwiches":  ["sandwich", "hoagie", "panini", "sub", "wrap", "club", "philly"],
    "Seafood":     ["salmon", "tuna", "shrimp", "lobster", "crab", "calamari", "oyster",
                    "scallop", "tilapia", "swordfish", "cod", "mahi", "trout", "mussel", "clam"],
    "Sushi":       ["sushi", "sashimi", "maki", "nigiri", "tempura"],
    "Mexican":     ["taco", "burrito", "quesadilla", "enchilada", "fajita", "nachos", "tostada"],
    "Chicken":     ["chicken", "wings", "tender", "drumstick", "rotisserie"],
    "Appetizers":  ["appetizer", "starter", "antipasto", "small plate", "fries", "mozzarella stick",
                    "bread", "dip", "wings", "nachos"],
    "Soups":       ["soup", "chowder", "bisque", "broth", "minestrone", "gazpacho"],
    "Desserts":    ["dessert", "cake", "tiramisu", "cheesecake", "ice cream", "gelato",
                    "pudding", "brownie", "cookie", "cannoli", "pie", "donut"],
    "Drinks":      ["coffee", "espresso", "latte", "tea", "soda", "juice", "lemonade",
                    "smoothie", "beer", "wine", "cocktail", "margarita", "vodka", "whiskey",
                    "tequila", "rum", "gin", "ale", "ipa", "lager", "claw", "seltzer", "shot",
                    "bottle", "draft"],
    "Breakfast":   ["pancake", "waffle", "omelette", "omelet", "egg", "bacon", "breakfast",
                    "french toast", "hash brown"],
    "Vegetarian":  ["vegan", "vegetarian", "tofu", "veggie"],
}

DIETARY_KEYWORDS = {
    "vegetarian": ["vegetarian", "veggie"],
    "vegan":      ["vegan"],
    "gluten-free": ["gluten-free", "gluten free", "(gf)"],
    "dairy-free": ["dairy-free", "dairy free"],
    "nut-free":   ["nut-free", "nut free"],
}

# Tokens that should never be the entire item name OR a section header
GARBAGE_ITEM_NAMES = {
    "menu", "food", "items", "share", "more", "new", "popular", "select one", "select",
}
# Common section-only words — perfectly valid as headers, never as items
SECTION_OK_HEADERS = {"drinks", "beverages", "starters", "appetizers", "entrees", "desserts", "mains"}

SECTION_HEADER_RE = re.compile(r"^[A-Z][A-Z &\-’'!?]{2,40}$")


def _classify(name: str, description: Optional[str]) -> str:
    blob = (name + " " + (description or "")).lower()
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(k in blob for k in kws):
            return cat
    return "Other"


def _dietary(text: str) -> List[str]:
    lower = text.lower()
    return [tag for tag, kws in DIETARY_KEYWORDS.items() if any(k in lower for k in kws)]


def _clean_name(s: str) -> str:
    s = re.sub(r"[.…]{2,}.*$", "", s)
    s = re.sub(r"[\-–—]{2,}.*$", "", s)
    s = s.strip(" .-\t–—:|·•")
    s = re.sub(r"\s+", " ", s)
    return s


def _is_section_header(line: str) -> bool:
    line = line.strip()
    if not line or any(ch.isdigit() for ch in line):
        return False
    if line.lower() == "menu":
        return False
    if 3 <= len(line) <= 50 and (line.isupper() or SECTION_HEADER_RE.match(line)):
        return True
    return False


def _split_priced_segments(line: str) -> List[Tuple[str, re.Match]]:
    """For a line with possibly multiple prices, yield (segment_before_price, price_match)
    so that "$3 Bottles  $5 Claws" becomes two items."""
    matches = list(PRICE_RE.finditer(line))
    if not matches:
        return []
    out: List[Tuple[str, re.Match]] = []
    last_end = 0
    for i, m in enumerate(matches):
        # Text from end of last price to this price (the "before" name on this segment)
        before = line[last_end : m.start()].strip(" :.-–—|·•\t")
        # If no leading text on this segment, name is everything from the END of this price
        # up to the start of the next price (or end-of-line)
        if not before:
            nxt_start = matches[i + 1].start() if i + 1 < len(matches) else len(line)
            before = line[m.end() : nxt_start].strip(" :.-–—|·•\t")
        out.append((before, m))
        last_end = m.end()
    return out


def parse_menu(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None

    raw_lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in raw_lines if 0 < len(ln) <= 300]

    sections: Dict[str, List[Dict[str, Any]]] = {}
    section_order: List[str] = []
    current = "Menu"
    sections[current] = []
    section_order.append(current)

    seen_names: set[str] = set()

    def push_item(name: str, description: Optional[str], match: re.Match):
        nonlocal current
        name = _clean_name(name)
        if not name or len(name) < 2:
            return
        if name.lower() in GARBAGE_ITEM_NAMES or name.lower() in SECTION_OK_HEADERS:
            return
        # Reject pure-numeric "names"
        if re.fullmatch(r"[\d\s$.,\-–—]+", name):
            return
        # Reject overly long names — likely a paragraph
        if len(name) > 100:
            name = name[:100].rstrip()
        key = name.lower()
        if key in seen_names:
            return

        try:
            lo = float(match.group("lo").replace(",", "."))
        except (ValueError, AttributeError):
            return
        hi_raw = match.group("hi")
        try:
            hi = float(hi_raw.replace(",", ".")) if hi_raw else None
        except (ValueError, AttributeError):
            hi = None

        if lo == 0 or lo > 500:
            return
        if hi is not None and (hi == 0 or hi > 500 or hi <= lo):
            hi = None

        if description:
            description = _clean_name(description)
            if not description or len(description) < 4:
                description = None

        seen_names.add(key)
        sections[current].append({
            "name": name,
            "description": description,
            "price": None if hi is not None else lo,
            "price_min": lo if hi is not None else None,
            "price_max": hi,
            "raw_price_text": match.group(0).strip(),
            "dietary_flags": _dietary((name + " " + (description or ""))),
            "_inferred_cat": _classify(name, description),
        })

    for i, line in enumerate(lines):
        if _is_section_header(line):
            current = _clean_name(line.title())
            if current not in sections:
                sections[current] = []
                section_order.append(current)
            continue

        # Find all price matches on this line
        priced_segments = _split_priced_segments(line)
        if not priced_segments:
            continue

        # Single-price line: figure out where the name came from
        if len(priced_segments) == 1:
            name, m = priced_segments[0]
            leading = line[: m.start()].strip(" :.-–—|·•\t")
            trailing = line[m.end():].strip(" :.-–—|·•\t")
            description: Optional[str] = None
            if leading:
                # Standard layout: "Item Name $price[ optional description]"
                description = trailing or None
            else:
                # Price-led layout: "$price Item Name" — name is already trailing; no description
                if not name and i > 0:
                    prev = lines[i - 1]
                    if prev and not PRICE_RE.search(prev) and not _is_section_header(prev):
                        name = prev
            # If we still have no description, peek at the next line for one
            if not description and i + 1 < len(lines):
                nxt = lines[i + 1]
                if (
                    nxt
                    and not PRICE_RE.search(nxt)
                    and not _is_section_header(nxt)
                    and len(nxt) > 8
                    and nxt.lower() != (name or "").lower()
                ):
                    description = nxt
            push_item(name, description, m)
            continue

        # Multi-price line: each segment is its own item
        for name, m in priced_segments:
            push_item(name, None, m)

    # Drop empty sections
    populated = [(n, items) for n, items in ((nm, sections[nm]) for nm in section_order) if items]
    if not populated:
        return None

    # If everything ended up under "Menu" with no real section boundaries,
    # auto-bucket by inferred category for a friendlier UX
    if len(populated) == 1 and len(populated[0][1]) >= 5:
        by_cat: Dict[str, List[Dict[str, Any]]] = {}
        for it in populated[0][1]:
            by_cat.setdefault(it.get("_inferred_cat", "Other"), []).append(it)
        if len(by_cat) > 1:
            populated = list(by_cat.items())

    result_sections = []
    for name, items in populated:
        inferred = [it.get("_inferred_cat", "Other") for it in items]
        food_cat = max(set(inferred), key=inferred.count) if inferred else "Other"
        cleaned = []
        for it in items:
            it.pop("_inferred_cat", None)
            cleaned.append(it)
        result_sections.append({"name": name, "food_category": food_cat, "items": cleaned})

    total = sum(len(s["items"]) for s in result_sections)
    if total < 2:
        return None

    return {"menu_found": True, "sections": result_sections}
