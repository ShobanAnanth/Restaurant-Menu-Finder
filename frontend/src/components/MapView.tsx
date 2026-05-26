import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import type { Restaurant } from '../types'
import L from 'leaflet'
import { MapPin } from './icons'

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

function makeImageIcon(photoUrl: string | undefined, selected = false): L.DivIcon {
  const size = selected ? 56 : 48
  if (!photoUrl) return makePinIcon('#f97316', selected)

  return L.divIcon({
    className: 'restaurant-image-icon',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        overflow: hidden;
        border: 3px solid white;
        box-shadow: 0 4px 16px rgba(15, 23, 42, ${selected ? 0.4 : 0.25});
        transition: all 0.2s ease;
        cursor: pointer;
      ">
        <img src="${photoUrl}" alt="restaurant" style="
          width: 100%;
          height: 100%;
          object-fit: cover;
        " onerror="this.style.display='none'" />
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 10],
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
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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
        const isHovered = r.google_place_id === hoveredId

        // Use image icon if available, otherwise fall back to pin icon
        const shouldHighlight = isSelected || isHovered
        const icon = r.photo_url
          ? makeImageIcon(r.photo_url, shouldHighlight)
          : shouldHighlight
            ? makePinIcon('#dc2626', true)
            : r.is_open_now === false
              ? makePinIcon('#94a3b8', false)
              : makePinIcon('#f97316', false)

        const mapsUrl = r.address
          ? `https://www.google.com/maps/search/${encodeURIComponent(r.name + ' ' + r.address)}`
          : `https://www.google.com/maps/search/${encodeURIComponent(r.name)}`

        return (
          <Marker
            key={r.google_place_id}
            position={[r.latitude, r.longitude]}
            icon={icon}
            eventHandlers={{
              click: () => onMarkerClick(r.google_place_id),
              mouseover: () => setHoveredId(r.google_place_id),
              mouseout: () => setHoveredId(null),
            }}
          >
            <Popup>
              <div className="text-sm min-w-[220px]">
                {r.photo_url && (
                  <img src={r.photo_url} alt={r.name} className="w-full h-32 object-cover rounded-lg mb-2" />
                )}
                <p className="font-bold text-ink-900">{r.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                {r.address && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 mt-2 font-medium"
                  >
                    <MapPin className="w-3 h-3" />
                    {r.address}
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
