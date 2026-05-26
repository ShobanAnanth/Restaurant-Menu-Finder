import os
import httpx
from typing import List, Dict, Any


def miles_to_meters(miles: float) -> float:
    return miles * 1609.344


def km_to_meters(km: float) -> float:
    return km * 1000.0


def radius_to_meters(radius: float, unit: str) -> float:
    if unit == "km":
        return km_to_meters(radius)
    return miles_to_meters(radius)


# Google Places (New API) price level mapping
_PRICE_MAP = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}

# Map Google type strings to human-readable cuisine labels
_TYPE_MAP = {
    "american_restaurant": "American",
    "chinese_restaurant": "Chinese",
    "italian_restaurant": "Italian",
    "japanese_restaurant": "Japanese",
    "mexican_restaurant": "Mexican",
    "thai_restaurant": "Thai",
    "indian_restaurant": "Indian",
    "french_restaurant": "French",
    "greek_restaurant": "Greek",
    "korean_restaurant": "Korean",
    "vietnamese_restaurant": "Vietnamese",
    "mediterranean_restaurant": "Mediterranean",
    "pizza_restaurant": "Pizza",
    "hamburger_restaurant": "Burgers",
    "seafood_restaurant": "Seafood",
    "steak_house": "Steaks",
    "sushi_restaurant": "Sushi",
    "fast_food_restaurant": "Fast Food",
    "sandwich_shop": "Sandwiches",
    "cafe": "Cafe",
    "bakery": "Bakery",
    "bar": "Bar",
    "breakfast_restaurant": "Breakfast",
    "brunch_restaurant": "Brunch",
}


def search_nearby_restaurants(lat: float, lng: float, radius_meters: float) -> List[Dict[str, Any]]:
    """Call Google Places Nearby Search (New API) and return normalized restaurant dicts."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not set")

    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,"
            "places.displayName,"
            "places.formattedAddress,"
            "places.location,"
            "places.nationalPhoneNumber,"
            "places.websiteUri,"
            "places.priceLevel,"
            "places.types,"
            "places.rating,"
            "places.currentOpeningHours,"
            "places.regularOpeningHours"
        ),
    }
    payload = {
        "includedTypes": ["restaurant"],
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(min(radius_meters, 50000)),  # API max 50 km
            }
        },
    }

    with httpx.Client(timeout=30) as client:
        resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()


    results = []
    for place in data.get("places", []):
        types = place.get("types", [])
        cuisine_categories = [_TYPE_MAP[t] for t in types if t in _TYPE_MAP] or ["Restaurant"]

        current_hours = place.get("currentOpeningHours") or {}
        is_open_now = current_hours.get("openNow")

        results.append({
            "google_place_id": place.get("id", ""),
            "name": place.get("displayName", {}).get("text", "Unknown"),
            "address": place.get("formattedAddress"),
            "latitude": (place.get("location") or {}).get("latitude"),
            "longitude": (place.get("location") or {}).get("longitude"),
            "phone": place.get("nationalPhoneNumber"),
            "website_url": place.get("websiteUri"),
            "price_level": _PRICE_MAP.get(place.get("priceLevel", ""), None),
            "cuisine_categories": cuisine_categories,
            "rating": place.get("rating"),
            "is_open_now": is_open_now,
            "opening_hours": place.get("regularOpeningHours"),
        })

    return results
