import type { Restaurant } from '../types'
import RestaurantCard from './RestaurantCard'

interface Props {
  restaurants: Restaurant[]
  selectedPlaceId: string | null
  loading: boolean
  onSelect: (placeId: string | null) => void
}

export default function RestaurantList({ restaurants, selectedPlaceId, loading, onSelect }: Props) {
  if (loading && restaurants.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scroll-elegant">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-shimmer shimmer-bg" />
        ))}
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-14 h-14 rounded-2xl bg-ink-100 flex items-center justify-center text-2xl mb-3">🍽️</div>
        <p className="text-sm font-semibold text-ink-700">No restaurants found</p>
        <p className="text-xs text-ink-500 mt-1 max-w-xs">Try widening your radius or clearing filters.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scroll-elegant">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur px-4 py-2.5 border-b border-ink-200">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
          {restaurants.length} {restaurants.length === 1 ? 'spot' : 'spots'} nearby
        </p>
      </div>
      <div className="divide-y divide-ink-100">
        {restaurants.map((r) => (
          <RestaurantCard
            key={r.google_place_id}
            restaurant={r}
            isSelected={r.google_place_id === selectedPlaceId}
            onSelect={() => onSelect(r.google_place_id === selectedPlaceId ? null : r.google_place_id)}
          />
        ))}
      </div>
    </div>
  )
}
