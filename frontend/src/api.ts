import axios from 'axios'
import type { Filters, MenuItem, MenuStatus, Restaurant, Unit } from './types'

// Use environment variable for API base URL, fall back to relative path for local dev
const apiBaseURL = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL: apiBaseURL })

// Build a fetchable URL for a photo reference returned by the backend
// (a bare "places/<id>/photos/<id>" string — never a full Google URL with key).
export function photoSrc(photoRef?: string | null): string | undefined {
  if (!photoRef) return undefined
  // If the backend (or legacy DB row) already returned a full URL, pass through.
  if (/^https?:\/\//i.test(photoRef)) return photoRef
  return `${apiBaseURL}/photos/${photoRef.replace(/^\/+/, '')}`
}

export async function fetchNearby(
  lat: number,
  lng: number,
  radius: number,
  unit: Unit,
): Promise<Restaurant[]> {
  // Filters (openOnly, price tiers, cuisines) are applied client-side so that
  // toggling a filter doesn't re-hit the paid Google Places API.
  const params: Record<string, unknown> = { lat, lng, radius, unit }
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
