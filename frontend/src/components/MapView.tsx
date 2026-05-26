import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import type { Restaurant } from '../types'
import L from 'leaflet'

function makePinIcon(color: string, selected = false): L.DivIcon {
  const size = selected ? 36 : 28
  return L.divIcon({
    className: '',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <div style="
          position: absolute; inset: 0;
          background: ${color};
          border: 2px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(15, 23, 42, ${selected ? 0.35 : 0.2});
        "></div>
        <div style="
          position: absolute; left: 50%; top: 40%;
          transform: translate(-50%, -50%);
          width: ${size * 0.4}px; height: ${size * 0.4}px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

const ICON_DEFAULT = makePinIcon('#f97316')
const ICON_SELECTED = makePinIcon('#dc2626', true)
const ICON_CLOSED = makePinIcon('#94a3b8')

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() || 13)
  }, [lat, lng, map])
  return null
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [lat, lng, map])
  return null
}

interface Props {
  location: { lat: number; lng: number } | null
  restaurants: Restaurant[]
  selectedPlaceId: string | null
  onMarkerClick: (placeId: string) => void
}

export default function MapView({ location, restaurants, selectedPlaceId, onMarkerClick }: Props) {
  const selected = useMemo(
    () => restaurants.find((r) => r.google_place_id === selectedPlaceId && r.latitude != null && r.longitude != null),
    [restaurants, selectedPlaceId],
  )

  if (!location) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink-100 to-ink-200">
        <p className="text-ink-400 text-sm font-medium">Waiting for location…</p>
      </div>
    )
  }

  return (
    <MapContainer center={[location.lat, location.lng]} zoom={13} className="w-full h-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Recenter lat={location.lat} lng={location.lng} />
      {selected && selected.latitude != null && selected.longitude != null && (
        <FlyTo lat={selected.latitude} lng={selected.longitude} />
      )}

      <Circle
        center={[location.lat, location.lng]}
        radius={60}
        pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.9, weight: 3 }}
      />

      {restaurants.map((r) => {
        if (!r.latitude || !r.longitude) return null
        const isSelected = r.google_place_id === selectedPlaceId
        const icon = isSelected
          ? ICON_SELECTED
          : r.is_open_now === false
            ? ICON_CLOSED
            : ICON_DEFAULT
        return (
          <Marker
            key={r.google_place_id}
            position={[r.latitude, r.longitude]}
            icon={icon}
            eventHandlers={{ click: () => onMarkerClick(r.google_place_id) }}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-bold text-ink-900">{r.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {r.is_open_now != null && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${r.is_open_now ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {r.is_open_now ? '● Open' : '● Closed'}
                    </span>
                  )}
                  {r.price_level && (
                    <span className="text-[11px] font-bold text-emerald-700">{'$'.repeat(r.price_level)}</span>
                  )}
                  {r.rating && <span className="text-[11px]">⭐ {r.rating.toFixed(1)}</span>}
                </div>
                {r.address && <p className="text-[11px] text-ink-500 mt-1">{r.address}</p>}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
