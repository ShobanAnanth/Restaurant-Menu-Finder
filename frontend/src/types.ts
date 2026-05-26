export type Unit = 'miles' | 'km'
export type SortMode = 'restaurant' | 'menu'

export interface Restaurant {
  id: string
  google_place_id: string
  name: string
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  website_url?: string
  price_level?: number        // 1–4
  cuisine_categories?: string[]
  rating?: number
  is_open_now?: boolean
  opening_hours?: unknown
  menu_status: 'none' | 'pending' | 'available' | 'unavailable' | 'error'
  sections?: MenuSection[]
}

export interface MenuSection {
  id: string
  name: string
  food_category?: string
  display_order: number
  items: MenuItem[]
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  price?: number
  price_min?: number
  price_max?: number
  raw_price_text?: string
  food_category?: string
  dietary_flags?: string[]
  // populated in menu-item search results
  restaurant_id?: string
  restaurant_name?: string
  google_place_id?: string
  is_open_now?: boolean
  price_level?: number
}

export interface MenuStatus {
  status: string
  restaurant_id: string
}

export interface Filters {
  openOnly: boolean
  priceMin?: number   // 1–4 restaurant price tier
  priceMax?: number
  cuisines: string[]
  // menu-item view specific
  itemPriceMin?: number
  itemPriceMax?: number
  category?: string
}
