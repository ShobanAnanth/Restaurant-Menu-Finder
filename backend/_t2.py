"""End-to-end fallback test: search → try each candidate → extract."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv; load_dotenv()

from services.search_fallback import find_menu_candidates
from services.scraper_service import scrape_menu
from services.llm_extraction_service import extract_menu_from_text

NAME = sys.argv[1] if len(sys.argv) > 1 else "Outback Steakhouse"
ADDR = sys.argv[2] if len(sys.argv) > 2 else "1000 Route 73, Marlton, NJ 08053"
OWN  = sys.argv[3] if len(sys.argv) > 3 else "https://www.outback.com"

print(f"--- searching for {NAME} ---")
cands = find_menu_candidates(NAME, ADDR, OWN, limit=6)
for c in cands:
    print(" cand:", c)
print()

for c in cands:
    print(f"=== TRYING {c} ===")
    try:
        r = scrape_menu(c)
    except Exception as e:
        print("  scrape failed:", e); continue
    print(f"  source={r.source}, structured={r.structured is not None}, text_len={len(r.text or '')}")
    if r.structured:
        total = sum(len(s["items"]) for s in r.structured["sections"])
        print(f"  STRUCTURED: {len(r.structured['sections'])} sections, {total} items")
        for sec in r.structured["sections"][:3]:
            print(f"    == {sec['name']} ({sec['food_category']}) — {len(sec['items'])} items ==")
            for it in sec["items"][:5]:
                print(f"       - {it['name']} : {it['raw_price_text']}")
        break
    elif r.text:
        m = extract_menu_from_text(r.text)
        if m and m.get("sections"):
            total = sum(len(s["items"]) for s in m["sections"])
            print(f"  HEURISTIC/LLM: {len(m['sections'])} sections, {total} items")
            for sec in m["sections"][:3]:
                print(f"    == {sec['name']} ({sec['food_category']}) — {len(sec['items'])} items ==")
                for it in sec["items"][:5]:
                    print(f"       - {it['name']} : {it['raw_price_text']}")
            break
        else:
            print("  no menu structure extracted")
    print()
