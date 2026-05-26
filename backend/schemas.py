from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class MenuItemOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    raw_price_text: Optional[str] = None
    food_category: Optional[str] = None
    dietary_flags: Optional[List[str]] = []

    class Config:
        from_attributes = True


class MenuSectionOut(BaseModel):
    id: str
    name: str
    food_category: Optional[str] = None
    display_order: int
    items: List[MenuItemOut] = []

    class Config:
        from_attributes = True


class RestaurantOut(BaseModel):
    id: str
    google_place_id: str
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    website_url: Optional[str] = None
    price_level: Optional[int] = None
    cuisine_categories: Optional[List[str]] = []
    rating: Optional[float] = None
    is_open_now: Optional[bool] = None
    opening_hours: Optional[Any] = None
    menu_status: str = "none"

    class Config:
        from_attributes = True


class RestaurantWithMenuOut(RestaurantOut):
    sections: List[MenuSectionOut] = []


class MenuStatusOut(BaseModel):
    status: str
    restaurant_id: str


class MenuItemWithRestaurantOut(MenuItemOut):
    restaurant_id: str
    restaurant_name: str
    google_place_id: str
    is_open_now: Optional[bool] = None
    price_level: Optional[int] = None
