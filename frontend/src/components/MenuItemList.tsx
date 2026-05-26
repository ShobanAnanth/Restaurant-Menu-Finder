import type { MenuItem } from '../types'
import { Sparkle } from './icons'

interface Props {
  items: MenuItem[]
  loading: boolean
  query: string
  onSelectRestaurant: (placeId: string) => void
}

function formatPrice(item: MenuItem): string {
  if (item.raw_price_text) return item.raw_price_text
  if (item.price != null) return `$${item.price.toFixed(2)}`
  if (item.price_min != null && item.price_max != null)
    return `$${item.price_min.toFixed(2)} – $${item.price_max.toFixed(2)}`
  return '—'
}

export default function MenuItemList({ items, loading, query, onSelectRestaurant }: Props) {
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scroll-elegant">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-shimmer shimmer-bg" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mb-3">
          <Sparkle className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-ink-700">
          {query ? `No matches for "${query}"` : 'No menu items yet'}
        </p>
        <p className="text-xs text-ink-500 mt-1 max-w-xs">
          Open a restaurant in the list and click <span className="font-semibold">View Menu</span> to scrape it. Once
          menus are loaded, you can search across all of them.
        </p>
      </div>
    )
  }

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.food_category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-y-auto scroll-elegant">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur px-4 py-2.5 border-b border-ink-200 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
          {items.length} {items.length === 1 ? 'item' : 'items'} ·{' '}
          {new Set(items.map((i) => i.restaurant_id)).size} restaurants
        </p>
        {query && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
            <Sparkle className="w-3 h-3" />
            Ranked by AI
          </span>
        )}
      </div>

      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, catItems]) => (
          <section key={category}>
            <div className="sticky top-[42px] bg-gradient-to-r from-violet-50 to-fuchsia-50 border-y border-violet-100 px-4 py-1.5 z-[5]">
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">{category}</span>
              <span className="ml-2 text-[11px] text-violet-400 font-semibold">{catItems.length}</span>
            </div>
            <div className="divide-y divide-ink-100">
              {catItems.map((item) => (
                <div key={item.id} className="px-4 py-2.5 hover:bg-ink-50 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 leading-snug">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      <button
                        className="mt-1 text-xs text-brand-700 hover:text-brand-800 font-semibold inline-flex items-center gap-1"
                        onClick={() => item.google_place_id && onSelectRestaurant(item.google_place_id)}
                      >
                        <span className="truncate max-w-[180px]">{item.restaurant_name}</span>
                        {item.is_open_now != null && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide ${
                              item.is_open_now ? 'text-emerald-600' : 'text-rose-500'
                            }`}
                          >
                            · {item.is_open_now ? 'Open' : 'Closed'}
                          </span>
                        )}
                        {item.price_level && (
                          <span className="text-[10px] text-ink-400 font-semibold">
                            · {'$'.repeat(item.price_level)}
                          </span>
                        )}
                      </button>
                    </div>
                    <span className="text-sm font-bold text-ink-900 whitespace-nowrap shrink-0 bg-ink-100 px-2 py-0.5 rounded-md">
                      {formatPrice(item)}
                    </span>
                  </div>
                  {item.dietary_flags && item.dietary_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.dietary_flags.map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full uppercase tracking-wide"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
