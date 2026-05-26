"""Quick verification of JSON-LD extraction and DuckDuckGo search."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv; load_dotenv()

from services.jsonld_menu_extractor import extract_from_html
from services.search_fallback import find_menu_candidates

# 1. Quick JSON-LD round-trip
HTML = """
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Test Diner",
  "hasMenu": {
    "@type": "Menu",
    "hasMenuSection": [
      {
        "@type": "MenuSection",
        "name": "Appetizers",
        "hasMenuItem": [
          {"@type": "MenuItem", "name": "Mozzarella Sticks", "description": "Crispy", "offers": {"@type": "Offer", "price": "8.99"}},
          {"@type": "MenuItem", "name": "Calamari", "offers": {"@type": "Offer", "price": "12.50"}}
        ]
      },
      {
        "@type": "MenuSection",
        "name": "Entrees",
        "hasMenuItem": [
          {"@type": "MenuItem", "name": "Margherita Pizza", "offers": {"@type": "Offer", "price": "14.95"}}
        ]
      }
    ]
  }
}
</script>
</head></html>
"""
print("=== JSON-LD synthetic ===")
r = extract_from_html(HTML)
print(json.dumps(r, indent=2))
print()

# 2. DuckDuckGo search
print("=== DuckDuckGo: Outback Steakhouse Marlton NJ ===")
cands = find_menu_candidates("Outback Steakhouse", "1000 Route 73, Marlton, NJ 08053, USA", "https://www.outback.com", limit=5)
for c in cands:
    print(" -", c)
print()

print("=== DuckDuckGo: Cracker Barrel Mount Laurel NJ ===")
cands = find_menu_candidates("Cracker Barrel", "111 Crossroads Dr, Mount Laurel, NJ 08054, USA", "https://www.crackerbarrel.com", limit=5)
for c in cands:
    print(" -", c)
