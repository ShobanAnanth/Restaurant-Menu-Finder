import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


def new_uuid():
    return str(uuid.uuid4())


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(String, primary_key=True, default=new_uuid)
    google_place_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    address = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    phone = Column(String)
    website_url = Column(Text)
    photo_url = Column(Text)
    price_level = Column(Integer) # 1–4
    cuisine_categories = Column(JSON, default=list)
    rating = Column(Float)
    is_open_now = Column(Boolean)
    opening_hours = Column(JSON)
    menu_status = Column(String, default="none")  # none|pending|available|unavailable|error
    menu_scraped_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    sections = relationship("MenuSection", back_populates="restaurant", cascade="all, delete-orphan")
    items = relationship("MenuItem", back_populates="restaurant", cascade="all, delete-orphan")


class MenuSection(Base):
    __tablename__ = "menu_sections"

    id = Column(String, primary_key=True, default=new_uuid)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String, nullable=False)
    food_category = Column(String)
    display_order = Column(Integer, default=0)

    restaurant = relationship("Restaurant", back_populates="sections")
    items = relationship("MenuItem", back_populates="section", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(String, primary_key=True, default=new_uuid)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False, index=True)
    section_id = Column(String, ForeignKey("menu_sections.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    price = Column(Float)
    price_min = Column(Float)
    price_max = Column(Float)
    raw_price_text = Column(String)
    food_category = Column(String, index=True)
    dietary_flags = Column(JSON, default=list)
    embedding = Column(JSON, nullable=True)

    restaurant = relationship("Restaurant", back_populates="items")
    section = relationship("MenuSection", back_populates="items")
