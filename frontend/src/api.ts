import axios from 'axios'
import type { Filters, MenuItem, MenuStatus, Restaurant, Unit } from './types'

// Use environment variable for API base URL, fall back to relative path for local dev
const apiBaseURL = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL: apiBaseURL })

export async function fetchNearby(
  lat: number,
  lng: number,
  radius: number,
  unit: Unit,
  filters: Filters,
): Promise<Restaurant[]> {
  const params: Record<string, unknown> = { lat, lng, radius, unit }
  if (filters.openOnly) params.open_only = true
  if (filters.priceMin != null) params.price_min = filters.priceMin
  if (filters.priceMax != null) params.price_max = filters.priceMax
  if (filters.cuisines.length === 1) params.cuisine = filters.cuisines[0]

  const { data } = await api.get<Restaurant[]>('/restaurants/nearby', { params })
  return data
}

export async function fetchMenu(placeId: string): Promise<Restaurant> {
  const { data } = await api.get<Restaurant>(`/restaurants/${placeId}/menu`)
  return data
}

export async function fetchMenuStatus(placeId: string): Promise<MenuStatus> {
  const { data } = await api.get<MenuStatus>(`/restaurants/${placeId}/menu/status`)
  return data
}

export async function searchMenuItems(filters: Filters, query?: string): Promise<MenuItem[]> {
  const params: Record<string, unknown> = {}
  if (query) params.q = query
  if (filters.category) params.category = filters.category
  if (filters.itemPriceMin != null) params.price_min = filters.itemPriceMin
  if (filters.itemPriceMax != null) params.price_max = filters.itemPriceMax
  if (filters.openOnly) params.open_only = true
  if (filters.priceMin != null) params.restaurant_price_min = filters.priceMin
  if (filters.priceMax != null) params.restaurant_price_max = filters.priceMax

  const { data } = await api.get<MenuItem[]>('/menu-items/search', { params })
  return data
}

export async function fetchCategories(): Promise<string[]> {
  const { data } = await api.get<string[]>('/menu-items/categories')
  return data
}
