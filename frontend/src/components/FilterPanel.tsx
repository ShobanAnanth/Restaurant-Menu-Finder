import type { Filters, SortMode } from '../types'
import { Search, Sparkle, X } from './icons'

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
  filters: Filters
  sortMode: SortMode
  menuQuery: string
  onFiltersChange: (f: Filters) => void
  onMenuQueryChange: (q: string) => void
}

export default function FilterPanel({ filters, sortMode, menuQuery, onFiltersChange, onMenuQueryChange }: Props) {
  const update = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch })

  const toggleCuisine = (c: string) => {
    const next = filters.cuisines.includes(c)
      ? filters.cuisines.filter((x) => x !== c)
      : [...filters.cuisines, c]
    update({ cuisines: next })
  }

  const togglePrice = (tier: number) => {
    if (!filters.priceMin || tier < filters.priceMin) {
      update({ priceMin: tier })
    } else if (!filters.priceMax || tier > filters.priceMax) {
      update({ priceMax: tier })
    } else if (filters.priceMin === tier) {
      update({ priceMin: undefined })
    } else if (filters.priceMax === tier) {
      update({ priceMax: undefined })
    }
  }

  const isPriceSelected = (tier: number) =>
    (filters.priceMin == null || tier >= filters.priceMin) &&
    (filters.priceMax == null || tier <= filters.priceMax) &&
    (filters.priceMin != null || filters.priceMax != null)

  return (
    <div className="bg-white border-b border-ink-200 px-5 py-2.5 shrink-0">
      {sortMode === 'menu' && (
        <div className="mb-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Try: spicy noodles, vegan burger, brunch under $15…"
              value={menuQuery}
              onChange={(e) => onMenuQueryChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-ink-50 border border-ink-200 text-sm font-medium placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-all"
            />
            {menuQuery && (
              <button
                onClick={() => onMenuQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1 rounded-md hover:bg-ink-100"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md uppercase tracking-wider pointer-events-none">
              <Sparkle className="w-3 h-3" />
              AI
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.openOnly}
            onChange={(e) => update({ openOnly: e.target.checked })}
            className="w-4 h-4 accent-emerald-600 rounded"
          />
          <span className="font-semibold text-ink-700">Open now</span>
        </label>

        <Group label="Price">
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
              className="ml-1 p-1 rounded-md text-ink-400 hover:text-rose-500 hover:bg-rose-50"
              title="Clear price"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </Group>

        {sortMode === 'restaurant' && (
          <Group label="Cuisine">
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
                  className="px-1.5 py-0.5 text-[11px] text-ink-400 hover:text-rose-500"
                >
                  Clear
                </button>
              )}
            </div>
          </Group>
        )}

        {sortMode === 'menu' && (
          <>
            <Group label="Category">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c}
                    active={filters.category === c}
                    onClick={() => update({ category: filters.category === c ? undefined : c })}
                    accent="violet"
                  >
                    {c}
                  </Chip>
                ))}
                {filters.category && (
                  <button
                    onClick={() => update({ category: undefined })}
                    className="px-1.5 py-0.5 text-[11px] text-ink-400 hover:text-rose-500"
                  >
                    Clear
                  </button>
                )}
              </div>
            </Group>

            <Group label="Item $">
              <input
                type="number"
                placeholder="Min"
                value={filters.itemPriceMin ?? ''}
                onChange={(e) => update({ itemPriceMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-16 px-2 py-1 text-xs font-medium rounded-md bg-ink-50 border border-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <span className="text-ink-400">–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.itemPriceMax ?? ''}
                onChange={(e) => update({ itemPriceMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-16 px-2 py-1 text-xs font-medium rounded-md bg-ink-50 border border-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </Group>
          </>
        )}
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-400">{label}</span>
      {children}
    </div>
  )
}

type Accent = 'brand' | 'rose' | 'violet'
const ACCENT: Record<Accent, { active: string; idle: string }> = {
  brand: {
    active: 'bg-brand-500 text-white border-brand-500 shadow-card',
    idle: 'bg-white text-ink-600 border-ink-200 hover:border-brand-400 hover:text-brand-700',
  },
  rose: {
    active: 'bg-rose-500 text-white border-rose-500 shadow-card',
    idle: 'bg-white text-ink-600 border-ink-200 hover:border-rose-400 hover:text-rose-700',
  },
  violet: {
    active: 'bg-violet-600 text-white border-violet-600 shadow-card',
    idle: 'bg-white text-ink-600 border-ink-200 hover:border-violet-400 hover:text-violet-700',
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
      className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${
        active ? c.active : c.idle
      }`}
    >
      {children}
    </button>
  )
}
