import {
  Icon,
  type LeafletEvent,
  type LeafletMouseEvent,
  type Marker as LeafletMarker,
} from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import React from 'react'
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'

import type { Location, PublicLocation } from '../../types'

const marker = new Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function Interaction({ onChange }: { onChange: (value: Location) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

function Recenter({ value }: { value: Location | null }) {
  const map = useMap()
  React.useEffect(() => {
    if (value)
      map.setView(
        [value.latitude, value.longitude],
        Math.max(map.getZoom(), 13),
      )
  }, [map, value])
  return null
}

export function LocationMap({
  value,
  publicZone,
  onChange,
  onTileError,
}: {
  value: Location | null
  publicZone?: PublicLocation | null | undefined
  onChange: (value: Location) => void
  onTileError: () => void
}) {
  const focus = value ?? publicZone ?? { latitude: 40.4168, longitude: -3.7038 }
  return (
    <MapContainer
      className="location-map-canvas"
      center={[focus.latitude, focus.longitude]}
      zoom={value || publicZone ? 13 : 5}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: onTileError }}
      />
      <Interaction onChange={onChange} />
      <Recenter value={value} />
      {publicZone && (
        <Circle
          center={[publicZone.latitude, publicZone.longitude]}
          radius={publicZone.radiusMeters}
          pathOptions={{
            color: '#28795c',
            fillColor: '#69a98d',
            fillOpacity: 0.16,
          }}
        />
      )}
      {value && (
        <Marker
          position={[value.latitude, value.longitude]}
          icon={marker}
          draggable
          keyboard
          title="Ubicación seleccionada; puedes arrastrarla"
          eventHandlers={{
            dragend(event: LeafletEvent) {
              const point = (event.target as LeafletMarker).getLatLng()
              onChange({ latitude: point.lat, longitude: point.lng })
            },
          }}
        />
      )}
    </MapContainer>
  )
}
