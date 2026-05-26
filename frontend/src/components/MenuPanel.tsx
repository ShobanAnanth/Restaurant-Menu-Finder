import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { fetchMenu, fetchMenuStatus } from '../api'
import type { MenuItem } from '../types'

function formatPrice(item: MenuItem): string {
  if (item.raw_price_text) return item.raw_price_text
  if (item.price != null) return `$${item.price.toFixed(2)}`
  if (item.price_min != null && item.price_max != null)
    return `$${item.price_min.toFixed(2)} – $${item.price_max.toFixed(2)}`
  return ''
}

interface Props {
  placeId: string
}

export default function MenuPanel({ placeId }: Props) {
  const {
    data: restaurant,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['menu', placeId],
    queryFn: () => fetchMenu(placeId),
    staleTime: 0,
  })

  const status = restaurant?.menu_status ?? 'none'
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (status === 'pending') {
      attemptsRef.current = 0
      intervalRef.current = setInterval(() => {
        attemptsRef.current += 1
        if (attemptsRef.current > 30) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          refetch()
          return
        }
        fetchMenuStatus(placeId)
          .then((s) => {
            if (s.status !== 'pending' && intervalRef.current) {
              clearInterval(intervalRef.current)
              refetch()
            }
          })
          .catch(() => {})
      }, 3000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, placeId, refetch])

  if (isLoading) return <Pending label="Loading menu…" />
  if (status === 'pending')
    return <Pending label="Scraping menu… this can take 15–30 seconds" progress={attemptsRef.current / 30} />

  if (status === 'unavailable' || status === 'error') {
    return (
      <InfoState
        tone="muted"
        emoji="🤷"
        title="Menu not available online"
        body="This restaurant doesn't appear to have a digital menu we could fetch."
      />
    )
  }

  if (status === 'none') {
    return (
      <InfoState
        tone="info"
        emoji="📥"
        title="Click View Menu again"
        body="We'll scrape and parse the menu for you."
      />
    )
  }

  const sections = restaurant?.sections ?? []
  if (sections.length === 0) {
    return <InfoState tone="muted" emoji="🍽️" title="No menu items found" body="The page was scraped but no menu structure could be extracted." />
  }

  return (
    <div className="mt-3 p-3 rounded-2xl bg-gradient-to-b from-ink-50 to-white border border-ink-100 space-y-4 animate-fade-in">
      {sections.map((section) => (
        <div key={section.id}>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-bold text-ink-800 uppercase tracking-wider">{section.name}</h4>
            {section.food_category && (
              <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                {section.food_category}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {section.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-white transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink-900">{item.name}</p>
                  {item.description && (
                    <p className="text-[11px] text-ink-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                  {item.dietary_flags && item.dietary_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.dietary_flags.map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wide"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold text-ink-900 whitespace-nowrap shrink-0">
                  {formatPrice(item)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Pending({ label, progress }: { label: string; progress?: number }) {
  return (
    <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-brand-50 to-rose-50 border border-brand-100 animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-ink-700 font-semibold">
        <svg className="animate-spin h-4 w-4 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        {label}
      </div>
      {progress != null && (
        <div className="mt-2 h-1 rounded-full bg-white/70 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-rose-500 transition-all"
            style={{ width: `${Math.min(progress * 100, 95)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function InfoState({
  tone,
  emoji,
  title,
  body,
}: {
  tone: 'muted' | 'info'
  emoji: string
  title: string
  body: string
}) {
  const toneCls =
    tone === 'info'
      ? 'bg-blue-50 border-blue-100 text-blue-800'
      : 'bg-ink-50 border-ink-100 text-ink-700'
  return (
    <div className={`mt-3 p-3 rounded-2xl border text-xs animate-fade-in ${toneCls}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">{emoji}</span>
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-[11px] opacity-80 mt-0.5">{body}</p>
        </div>
      </div>
    </div>
  )
}
