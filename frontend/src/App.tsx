import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { fetchNearby, searchMenuItems } from './api'
import type { Filters, Restaurant, SortMode, Unit } from './types'
import FilterPanel from './components/FilterPanel'
import FiltersDrawer from './components/FiltersDrawer'
import MapView from './components/MapView'
import RestaurantList from './components/RestaurantList'
import MenuItemList from './components/MenuItemList'
import SearchControls from './components/SearchControls'
import MobileBottomSheet from './components/MobileBottomSheet'
import { Burger, Sliders, Sparkle, Utensils } from './components/icons'

const DEFAULT_FILTERS: Filters = {
  openOnly: false,
  cuisines: [],
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

type Snap = 'collapsed' | 'mid' | 'full'

export default function App() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radius, setRadius] = useState(5)
  const [unit, setUnit] = useState<Unit>('miles')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sortMode, setSortMode] = useState<SortMode>('restaurant')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [menuQuery, setMenuQuery] = useState('')

  // Mobile UI state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<Snap>('mid')

  const debouncedMenuQuery = useDebounced(menuQuery, 350)

  const {
    data: rawRestaurants = [],
    isFetching: loadingRestaurants,
    error: restaurantError,
  } = useQuery({
    queryKey: ['restaurants', location, radius, unit],
    queryFn: () => fetchNearby(location!.lat, location!.lng, radius, unit),
    enabled: !!location,
  })

  const restaurants = useMemo(() => {
    return rawRestaurants.filter((r) => {
      if (filters.openOnly && r.is_open_now !== true) return false
      if (filters.priceMin != null && (r.price_level == null || r.price_level < filters.priceMin)) return false
      if (filters.priceMax != null && (r.price_level == null || r.price_level > filters.priceMax)) return false
      if (filters.cuisines.length > 0) {
        const cats = (r.cuisine_categories || []).map((c) => c.toLowerCase())
        const ok = filters.cuisines.some((sel) => cats.some((c) => c.includes(sel.toLowerCase())))
        if (!ok) return false
      }
      return true
    })
  }, [rawRestaurants, filters])

  const {
    data: menuItems = [],
    isFetching: loadingMenuItems,
  } = useQuery({
    queryKey: ['menuItems', filters, debouncedMenuQuery],
    queryFn: () => searchMenuItems(filters, debouncedMenuQuery || undefined),
    enabled: sortMode === 'menu',
  })

  const handleLocate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => alert(`Could not get location: ${err.message}`),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }, [])

  const selectedRestaurant: Restaurant | undefined =
    restaurants.find((r) => r.google_place_id === selectedPlaceId)

  // When a marker is tapped on mobile, raise the sheet so the user can see the card
  const handleMarkerClick = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId)
    setSheetSnap((s) => (s === 'collapsed' ? 'mid' : s))
  }, [])

  const activeFilterCount =
    (filters.openOnly ? 1 : 0) +
    (filters.priceMin != null || filters.priceMax != null ? 1 : 0) +
    filters.cuisines.length +
    (filters.category ? 1 : 0) +
    (filters.itemPriceMin != null || filters.itemPriceMax != null ? 1 : 0)

  const sheetSummary = !location
    ? 'Use my location to start'
    : sortMode === 'restaurant'
      ? `${restaurants.length} ${restaurants.length === 1 ? 'spot' : 'spots'} nearby`
      : `${menuItems.length} ${menuItems.length === 1 ? 'item' : 'items'}`

  const listContent = !location ? (
    <EmptyHero onLocate={handleLocate} />
  ) : restaurantError ? (
    <ErrorState message="Couldn't load restaurants. Verify your Places API key and try again." />
  ) : sortMode === 'restaurant' ? (
    <RestaurantList
      restaurants={restaurants}
      selectedPlaceId={selectedPlaceId}
      loading={loadingRestaurants}
      onSelect={setSelectedPlaceId}
    />
  ) : (
    <MenuItemList
      items={menuItems}
      loading={loadingMenuItems}
      query={debouncedMenuQuery}
      onSelectRestaurant={(id) => {
        setSortMode('restaurant')
        setSelectedPlaceId(id)
      }}
    />
  )

  return (
    <div className="flex flex-col h-svh bg-ink-50 font-sans text-ink-900">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-ink-200 px-4 md:px-5 py-3 flex items-center gap-3 md:gap-5 shadow-card z-20 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-rose-500 text-white flex items-center justify-center shadow-pop">
            <Burger className="w-5 h-5" />
          </div>
          <div className="leading-tight hidden sm:block">
            <h1 className="text-base font-bold text-ink-900 tracking-tight">MenuFinder</h1>
            <p className="text-[10px] text-ink-500 font-medium uppercase tracking-wider">Discover · Search · Eat</p>
          </div>
        </div>

        <SearchControls
          radius={radius}
          unit={unit}
          onRadiusChange={setRadius}
          onUnitChange={setUnit}
          onLocate={handleLocate}
          hasLocation={!!location}
          loading={loadingRestaurants}
        />

        {/* Mobile Filters button — desktop hides it (chips show inline below) */}
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="md:hidden relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-100 text-ink-700 text-sm font-semibold"
          aria-label="Open filters"
        >
          <Sliders className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="ml-auto flex p-1 rounded-xl bg-ink-100 text-sm shrink-0">
          <button
            className={`px-2.5 md:px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              sortMode === 'restaurant'
                ? 'bg-white text-ink-900 shadow-card'
                : 'text-ink-500 hover:text-ink-800'
            }`}
            onClick={() => setSortMode('restaurant')}
          >
            <Utensils className="w-4 h-4" />
            <span className="hidden sm:inline">Restaurants</span>
          </button>
          <button
            className={`px-2.5 md:px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              sortMode === 'menu'
                ? 'bg-white text-ink-900 shadow-card'
                : 'text-ink-500 hover:text-ink-800'
            }`}
            onClick={() => setSortMode('menu')}
          >
            <Sparkle className="w-4 h-4" />
            <span className="hidden sm:inline">Menu Items</span>
          </button>
        </div>
      </header>

      {/* ── Filter bar (desktop chip bar inline; mobile menu-search inline) ─── */}
      <FilterPanel
        filters={filters}
        sortMode={sortMode}
        menuQuery={menuQuery}
        onFiltersChange={setFilters}
        onMenuQueryChange={setMenuQuery}
      />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop sidebar (hidden on mobile — sheet takes over) */}
        <aside className="hidden md:flex w-[420px] flex-col border-r border-ink-200 bg-white overflow-hidden">
          {listContent}
        </aside>

        {/* Map fills remaining space on desktop, full-bleed on mobile */}
        <div className="flex-1 relative bg-ink-100">
          <MapView
            location={location}
            restaurants={restaurants}
            selectedPlaceId={selectedPlaceId}
            onMarkerClick={handleMarkerClick}
          />
          {!location && (
            <div className="absolute inset-0 hidden md:flex items-center justify-center pointer-events-none">
              <div className="bg-white/85 backdrop-blur px-5 py-3 rounded-2xl shadow-pop text-sm text-ink-600 font-medium">
                The map will appear after location is set
              </div>
            </div>
          )}
          {selectedRestaurant && location && (
            <SelectedBadge restaurant={selectedRestaurant} />
          )}
        </div>

        {/* Mobile bottom sheet (takes the listContent) */}
        <MobileBottomSheet
          summary={sheetSummary}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
        >
          {listContent}
        </MobileBottomSheet>
      </div>

      {/* Mobile filters drawer */}
      <FiltersDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        sortMode={sortMode}
        radius={radius}
        unit={unit}
        onRadiusChange={setRadius}
        onUnitChange={setUnit}
        activeCount={activeFilterCount}
      />
    </div>
  )
}

function EmptyHero({ onLocate }: { onLocate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 via-rose-500 to-pink-500 text-white flex items-center justify-center shadow-pop mb-5">
        <Burger className="w-9 h-9" />
      </div>
      <h2 className="text-xl font-bold text-ink-900 tracking-tight">Find restaurants near you</h2>
      <p className="text-sm text-ink-500 mt-1.5 max-w-xs leading-relaxed">
        Tap <span className="font-semibold text-ink-700">Use My Location</span> to discover nearby spots,
        browse live menus, and search across thousands of dishes.
      </p>
      <button
        onClick={onLocate}
        className="mt-5 md:hidden px-5 py-2.5 bg-gradient-to-r from-brand-500 to-rose-500 text-white rounded-xl font-bold shadow-card"
      >
        Use My Location
      </button>
      <div className="grid grid-cols-3 gap-2 mt-6 w-full max-w-xs">
        <FeatureChip icon="🍔" label="Menus" />
        <FeatureChip icon="🔎" label="AI Search" />
        <FeatureChip icon="📍" label="Live Status" />
      </div>
    </div>
  )
}

function FeatureChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-ink-50 border border-ink-100">
      <span className="text-xl">{icon}</span>
      <span className="text-[11px] font-semibold text-ink-600 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-3xl mb-3">!</div>
      <p className="text-sm text-ink-700 font-medium max-w-xs">{message}</p>
    </div>
  )
}

function SelectedBadge({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-pop text-sm font-semibold text-ink-800 flex items-center gap-2 animate-fade-in z-[400] max-w-[80vw] truncate">
      <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
      <span className="truncate">{restaurant.name}</span>
    </div>
  )
}
