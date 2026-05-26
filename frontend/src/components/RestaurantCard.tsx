import { useState } from 'react'
import type { Restaurant } from '../types'
import MenuPanel from './MenuPanel'
import { ChevronDown, ChevronUp, Globe, Phone, Star } from './icons'

interface Props {
  restaurant: Restaurant
  isSelected: boolean
  onSelect: () => void
}

function PriceLevel({ level }: { level?: number }) {
  if (!level) return <span className="text-ink-400 text-xs font-medium">—</span>
  return (
    <span className="text-emerald-700 text-xs font-bold tracking-wider">
      {'$'.repeat(level)}
      <span className="text-ink-300">{'$'.repeat(4 - level)}</span>
    </span>
  )
}

export default function RestaurantCard({ restaurant: r, isSelected, onSelect }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  const openBadge = r.is_open_now == null ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-ink-100 text-ink-500">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-400" />
      Hours unknown
    </span>
  ) : r.is_open_now ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      Closed
    </span>
  )

  return (
    <div
      className={`group relative px-4 py-3 cursor-pointer transition-all ${
        isSelected ? 'bg-brand-50/60' : 'hover:bg-ink-50'
      }`}
      onClick={onSelect}
    >
      {isSelected && <span className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-brand-500 to-rose-500 rounded-r-full" />}

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 transition-colors ${
          isSelected ? 'bg-gradient-to-br from-brand-500 to-rose-500 text-white' : 'bg-ink-100 text-ink-600 group-hover:bg-ink-200'
        }`}>
          {r.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-ink-900 text-sm leading-snug truncate">{r.name}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {r.rating != null && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-700">
                  <Star className="w-3 h-3 text-amber-500" />
                  {r.rating.toFixed(1)}
                </span>
              )}
              <PriceLevel level={r.price_level} />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {openBadge}
            {r.cuisine_categories && r.cuisine_categories.length > 0 && (
              <span className="text-[11px] text-ink-500 truncate">{r.cuisine_categories.slice(0, 2).join(' · ')}</span>
            )}
          </div>

          {r.address && (
            <p className="text-[11px] text-ink-500 mt-1 line-clamp-1">{r.address}</p>
          )}

          <div className="flex items-center gap-1.5 mt-2">
            <button
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                menuOpen
                  ? 'bg-ink-900 text-white shadow-card'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
            >
              {menuOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {menuOpen ? 'Hide Menu' : 'View Menu'}
            </button>
            {r.website_url && (
              <a
                href={r.website_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-ink-100 hover:bg-ink-200 text-ink-600"
                title={r.website_url}
              >
                <Globe className="w-3.5 h-3.5" />
              </a>
            )}
            {r.phone && (
              <a
                href={`tel:${r.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-ink-100 hover:bg-ink-200 text-ink-600"
                title={r.phone}
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div onClick={(e) => e.stopPropagation()} className="animate-fade-in">
          <MenuPanel placeId={r.google_place_id} />
        </div>
      )}
    </div>
  )
}
