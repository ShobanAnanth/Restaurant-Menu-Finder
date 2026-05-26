import type { Unit } from '../types'
import { MapPin, Refresh, Sliders } from './icons'

interface Props {
  radius: number
  unit: Unit
  onRadiusChange: (v: number) => void
  onUnitChange: (u: Unit) => void
  onLocate: () => void
  hasLocation: boolean
  loading: boolean
}

export default function SearchControls({
  radius,
  unit,
  onRadiusChange,
  onUnitChange,
  onLocate,
  hasLocation,
  loading,
}: Props) {
  const max = unit === 'miles' ? 25 : 40

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={onLocate}
        disabled={loading}
        className="group inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-brand-500 to-rose-500 hover:from-brand-600 hover:to-rose-600 disabled:opacity-60 text-white text-sm rounded-xl font-semibold shadow-card hover:shadow-card-hover transition-all"
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : hasLocation ? (
          <Refresh className="w-4 h-4" />
        ) : (
          <MapPin className="w-4 h-4" />
        )}
        {hasLocation ? 'Refresh' : 'Use My Location'}
      </button>

      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-ink-50 border border-ink-200">
        <Sliders className="w-4 h-4 text-ink-400" />
        <input
          type="range"
          min={0.5}
          max={max}
          step={0.5}
          value={Math.min(radius, max)}
          onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
          className="w-32 accent-brand-500 h-1"
        />
        <span className="text-xs font-semibold text-ink-700 tabular-nums w-14 text-right">
          {radius} {unit}
        </span>
      </div>

      <div className="inline-flex p-0.5 rounded-lg bg-ink-100 text-xs font-semibold">
        <button
          onClick={() => onUnitChange('miles')}
          className={`px-2.5 py-1 rounded-md transition-all ${
            unit === 'miles' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          mi
        </button>
        <button
          onClick={() => onUnitChange('km')}
          className={`px-2.5 py-1 rounded-md transition-all ${
            unit === 'km' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          km
        </button>
      </div>
    </div>
  )
}
