import type { Filters, SortMode, Unit } from '../types'
import { X } from './icons'

const PRICE_TIERS = [
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
  { value: 4, label: '$$$$' },
]

const CUISINES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'Mediterranean', 'Seafood', 'Pizza', 'Burgers', 'Steaks',
  'Sushi', 'Sandwiches', 'Fast Food', 'Breakfast',
]

const CATEGORIES = [
  'Burgers', 'Steaks', 'Pizza', 'Pasta', 'Salads', 'Sandwiches',
  'Seafood', 'Sushi', 'Mexican', 'Chicken', 'Appetizers',
  'Soups', 'Desserts', 'Drinks', 'Breakfast', 'Vegetarian',
]

interface Props {
  open: boolean
  onClose: () => void
  filters: Filters
  onFiltersChange: (f: Filters) => void
  sortMode: SortMode
  radius: number
  unit: Unit
  onRadiusChange: (v: number) => void
  onUnitChange: (u: Unit) => void
  activeCount: number
}

export default function FiltersDrawer({
  open,
  onClose,
  filters,
  onFiltersChange,
  sortMode,
  radius,
  unit,
  onRadiusChange,
  onUnitChange,
  activeCount,
}: Props) {
  if (!open) return null

  const update = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch })
  const max = unit === 'miles' ? 25 : 40

  const togglePrice = (tier: number) => {
    if (!filters.priceMin || tier < filters.priceMin) update({ priceMin: tier })
    else if (!filters.priceMax || tier > filters.priceMax) update({ priceMax: tier })
    else if (filters.priceMin === tier) update({ priceMin: undefined })
    else if (filters.priceMax === tier) update({ priceMax: undefined })
  }
  const isPriceSelected = (tier: number) =>
    (filters.priceMin == null || tier >= filters.priceMin) &&
    (filters.priceMax == null || tier <= filters.priceMax) &&
    (filters.priceMin != null || filters.priceMax != null)

  const toggleCuisine = (c: string) => {
    const next = filters.cuisines.includes(c)
      ? filters.cuisines.filter((x) => x !== c)
      : [...filters.cuisines, c]
    update({ cuisines: next })
  }

  const clearAll = () => {
    onFiltersChange({ openOnly: false, cuisines: [] })
  }

  return (
    <>
      <div
        className="md:hidden fixed inset-0 bg-ink-900/50 z-[1100] animate-fade-in"
        onClick={onClose}
      />
      <div className="md:hidden fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl z-[1200] max-h-[88svh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-ink-900">Filters</h3>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 bg-brand-500 text-white text-[10px] font-bold rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          <Section label="Search radius">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={max}
                step={0.5}
                value={Math.min(radius, max)}
                onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
                className="flex-1 accent-brand-500 h-1"
              />
              <span className="text-sm font-semibold text-ink-700 tabular-nums w-16 text-right">
                {radius} {unit}
              </span>
            </div>
            <div className="inline-flex mt-2 p-0.5 rounded-lg bg-ink-100 text-xs font-semibold">
              <button
                onClick={() => onUnitChange('miles')}
                className={`px-3 py-1 rounded-md transition-all ${
                  unit === 'miles' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500'
                }`}
              >
                mi
              </button>
              <button
                onClick={() => onUnitChange('km')}
                className={`px-3 py-1 rounded-md transition-all ${
                  unit === 'km' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500'
                }`}
              >
                km
              </button>
            </div>
          </Section>

          <Section label="Hours">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.openOnly}
                onChange={(e) => update({ openOnly: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              <span className="font-semibold text-ink-700 text-sm">Open now only</span>
            </label>
          </Section>

          <Section label="Restaurant price">
            <div className="flex gap-1.5">
              {PRICE_TIERS.map((t) => (
                <Chip
                  key={t.value}
                  active={isPriceSelected(t.value)}
                  onClick={() => togglePrice(t.value)}
                  accent="brand"
                >
                  {t.label}
                </Chip>
              ))}
              {(filters.priceMin != null || filters.priceMax != null) && (
                <button
                  onClick={() => update({ priceMin: undefined, priceMax: undefined })}
                  className="px-2 py-1 text-[11px] text-ink-400 hover:text-rose-500"
                >
                  Clear
                </button>
              )}
            </div>
          </Section>

          {sortMode === 'restaurant' && (
            <Section label="Cuisine">
              <div className="flex flex-wrap gap-1.5">
                {CUISINES.map((c) => (
                  <Chip
                    key={c}
                    active={filters.cuisines.includes(c)}
                    onClick={() => toggleCuisine(c)}
                    accent="rose"
                  >
                    {c}
                  </Chip>
                ))}
                {filters.cuisines.length > 0 && (
                  <button
                    onClick={() => update({ cuisines: [] })}
                    className="px-2 py-1 text-[11px] text-ink-400 hover:text-rose-500"
                  >
                    Clear
                  </button>
                )}
              </div>
            </Section>
          )}

          {sortMode === 'menu' && (
            <>
              <Section label="Category">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      active={filters.category === c}
                      onClick={() =>
                        update({ category: filters.category === c ? undefined : c })
                      }
                      accent="violet"
                    >
                      {c}
                    </Chip>
                  ))}
                  {filters.category && (
                    <button
                      onClick={() => update({ category: undefined })}
                      className="px-2 py-1 text-[11px] text-ink-400 hover:text-rose-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </Section>

              <Section label="Item price">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.itemPriceMin ?? ''}
                    onChange={(e) =>
                      update({
                        itemPriceMin: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-20 px-2 py-1.5 text-sm rounded-md bg-ink-50 border border-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <span className="text-ink-400">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.itemPriceMax ?? ''}
                    onChange={(e) =>
                      update({
                        itemPriceMax: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-20 px-2 py-1.5 text-sm rounded-md bg-ink-50 border border-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-ink-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-brand-500 to-rose-500 text-white font-bold rounded-xl shadow-card"
          >
            Show results
          </button>
        </div>
      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-2">
        {label}
      </h4>
      {children}
    </div>
  )
}

type Accent = 'brand' | 'rose' | 'violet'
const ACCENT: Record<Accent, { active: string; idle: string }> = {
  brand: {
    active: 'bg-brand-500 text-white border-brand-500',
    idle: 'bg-white text-ink-600 border-ink-200',
  },
  rose: {
    active: 'bg-rose-500 text-white border-rose-500',
    idle: 'bg-white text-ink-600 border-ink-200',
  },
  violet: {
    active: 'bg-violet-600 text-white border-violet-600',
    idle: 'bg-white text-ink-600 border-ink-200',
  },
}

function Chip({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean
  onClick: () => void
  accent: Accent
  children: React.ReactNode
}) {
  const c = ACCENT[accent]
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm font-semibold transition-all ${
        active ? c.active : c.idle
      }`}
    >
      {children}
    </button>
  )
}
