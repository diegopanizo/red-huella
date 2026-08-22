import React from 'react'
import { Circle, MapContainer, TileLayer } from 'react-leaflet'

import type { PublicationType, PublicLocation } from '../../types'

const contextByType: Record<PublicationType, string> = {
  LOST: 'Zona aproximada donde se reportó la pérdida',
  FOUND: 'Zona aproximada donde fue encontrado',
  ADOPTION: 'Zona aproximada de referencia',
}

export function PublicLocationMap({
  publicLocation,
  type,
  height,
}: {
  publicLocation: PublicLocation
  type: PublicationType
  height?: number | undefined
}) {
  const [tileError, setTileError] = React.useState(false)
  return (
    <section
      className="public-location"
      aria-labelledby="public-location-title"
    >
      <h2 id="public-location-title">{contextByType[type]}</h2>
      <p>Por privacidad, la ubicación mostrada es aproximada.</p>
      <MapContainer
        className="public-location-map"
        center={[publicLocation.latitude, publicLocation.longitude]}
        zoom={publicLocation.radiusMeters >= 5_000 ? 11 : 13}
        scrollWheelZoom={false}
        style={height === undefined ? undefined : { height }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <Circle
          center={[publicLocation.latitude, publicLocation.longitude]}
          radius={publicLocation.radiusMeters}
          pathOptions={{
            color: '#28795c',
            fillColor: '#69a98d',
            fillOpacity: 0.2,
          }}
        />
      </MapContainer>
      {tileError && (
        <p role="alert">
          No se pudo cargar el mapa. La información de la publicación sigue
          disponible.
        </p>
      )}
    </section>
  )
}
