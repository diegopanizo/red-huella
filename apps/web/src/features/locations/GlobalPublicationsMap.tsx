import { divIcon } from 'leaflet'
import React from 'react'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { Link } from 'react-router-dom'

import { resolveApiAssetUrl } from '../../services/api'
import type { MapBounds, MapPublication, PublicationType } from '../../types'
import { GLOBAL_MAP_MAX_ZOOM } from './map-config'
import { normalizeMapBounds } from './map-bounds'

const typeLabels: Record<PublicationType, string> = {
  LOST: 'Perdido',
  FOUND: 'Encontrado',
  ADOPTION: 'Adopción',
}
const speciesLabels = { DOG: 'Perro', CAT: 'Gato', OTHER: 'Otro' } as const
const markerLetters: Record<PublicationType, string> = {
  LOST: 'P',
  FOUND: 'E',
  ADOPTION: 'A',
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(value),
  )

function Thumbnail({ publication }: { publication: MapPublication }) {
  const [broken, setBroken] = React.useState(false)
  const name = publication.animal.name ?? publication.title
  return publication.thumbnail && !broken ? (
    <img
      src={resolveApiAssetUrl(publication.thumbnail.url)}
      width={publication.thumbnail.width}
      height={publication.thumbnail.height}
      alt={`Imagen de ${name}`}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  ) : (
    <span
      className="map-thumbnail-placeholder"
      aria-label="Imagen no disponible"
    >
      <span aria-hidden="true">🐾</span>
    </span>
  )
}

function SelectionController({
  publication,
  programmaticMoveRef,
}: {
  publication: MapPublication | undefined
  programmaticMoveRef: React.RefObject<boolean>
}) {
  const map = useMap()
  React.useEffect(() => {
    if (!publication) return
    programmaticMoveRef.current = true
    const release = () => {
      programmaticMoveRef.current = false
    }
    map.once('moveend', release)
    map.flyTo(
      [publication.publicLocation.lat, publication.publicLocation.long],
      Math.min(Math.max(map.getZoom(), 8), GLOBAL_MAP_MAX_ZOOM),
      { animate: true, duration: 0.35 },
    )
    return () => {
      map.off('moveend', release)
    }
  }, [map, programmaticMoveRef, publication])
  return null
}

function ViewportReporter({
  onBoundsChange,
  programmaticMoveRef,
  skipInitialReport,
}: {
  onBoundsChange: ((bounds: MapBounds) => void) | undefined
  programmaticMoveRef: React.RefObject<boolean>
  skipInitialReport: boolean
}) {
  const map = useMap()
  const report = React.useCallback(() => {
    if (!onBoundsChange || programmaticMoveRef.current) return
    const normalized = normalizeMapBounds(map.getBounds())
    if (normalized) onBoundsChange(normalized)
  }, [map, onBoundsChange, programmaticMoveRef])
  useMapEvents({ moveend: report, zoomend: report })
  React.useEffect(() => {
    if (!skipInitialReport) report()
  }, [map, report, skipInitialReport])
  return null
}

function FocusBoundsController({
  bounds,
  programmaticMoveRef,
}: {
  bounds: MapBounds | null
  programmaticMoveRef: React.RefObject<boolean>
}) {
  const map = useMap()
  React.useEffect(() => {
    if (!bounds) return
    programmaticMoveRef.current = true
    const release = () => {
      programmaticMoveRef.current = false
    }
    map.once('moveend', release)
    map.fitBounds(
      [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ],
      { animate: true, padding: [24, 24], maxZoom: GLOBAL_MAP_MAX_ZOOM },
    )
    return () => {
      map.off('moveend', release)
    }
  }, [bounds, map, programmaticMoveRef])
  return null
}

function VisibilityController({ visible }: { visible: boolean }) {
  const map = useMap()
  React.useEffect(() => {
    if (!visible) return
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [map, visible])
  return null
}

export interface GlobalPublicationsMapProps {
  publications: readonly MapPublication[]
  selectedPublicationId: string | null
  onSelectPublication: (id: string) => void
  onOpenPublication: (id: string) => void
  initialBounds: MapBounds
  focusBounds?: MapBounds | null
  visible?: boolean
  onBoundsChange?: ((bounds: MapBounds) => void) | undefined
}

export function GlobalPublicationsMap({
  publications,
  selectedPublicationId,
  onSelectPublication,
  onOpenPublication,
  initialBounds,
  focusBounds = null,
  visible = true,
  onBoundsChange,
}: GlobalPublicationsMapProps) {
  const [tileError, setTileError] = React.useState(false)
  const programmaticMoveRef = React.useRef(false)
  const selected = publications.find(
    (publication) => publication.id === selectedPublicationId,
  )
  return (
    <div className="global-map-wrapper">
      <MapContainer
        className="global-map-canvas"
        bounds={[
          [initialBounds.south, initialBounds.west],
          [initialBounds.north, initialBounds.east],
        ]}
        maxZoom={GLOBAL_MAP_MAX_ZOOM}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <ViewportReporter
          onBoundsChange={onBoundsChange}
          programmaticMoveRef={programmaticMoveRef}
          skipInitialReport={focusBounds !== null}
        />
        <FocusBoundsController
          bounds={focusBounds}
          programmaticMoveRef={programmaticMoveRef}
        />
        <VisibilityController visible={visible} />
        <SelectionController
          publication={selected}
          programmaticMoveRef={programmaticMoveRef}
        />
        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
          {publications.map((publication) => {
            const active = publication.id === selectedPublicationId
            const markerLabel = `${typeLabels[publication.type]}: ${publication.animal.name ?? publication.title}; zona aproximada`
            return (
              <Marker
                key={publication.id}
                position={[
                  publication.publicLocation.lat,
                  publication.publicLocation.long,
                ]}
                icon={divIcon({
                  className: '',
                  html: `<span class="approximate-marker ${publication.type.toLowerCase()}${active ? ' selected' : ''}" aria-hidden="true">${markerLetters[publication.type]}</span>`,
                  iconSize: [44, 44],
                  iconAnchor: [22, 22],
                })}
                keyboard
                title={markerLabel}
                alt={markerLabel}
                eventHandlers={{
                  click: () => onSelectPublication(publication.id),
                }}
              >
                <Popup
                  className="publication-map-popup"
                  maxWidth={320}
                  minWidth={240}
                >
                  <article
                    className="map-popup"
                    data-publication-id={publication.id}
                  >
                    <Thumbnail publication={publication} />
                    <div>
                      <span
                        className={`badge map-popup-badge ${publication.type.toLowerCase()}`}
                      >
                        {typeLabels[publication.type]}
                      </span>
                      <strong>
                        {publication.animal.name ?? publication.title}
                      </strong>
                      {publication.animal.name && (
                        <span>{publication.title}</span>
                      )}
                      <span>
                        {speciesLabels[publication.animal.species]}
                        {publication.animal.breed?.trim()
                          ? ` · ${publication.animal.breed}`
                          : ''}
                      </span>
                      <span>{formatDate(publication.eventDate)}</span>
                      <span>Zona aproximada protegida</span>
                      <Link
                        to={`/publications/${publication.id}`}
                        onClick={() => onOpenPublication(publication.id)}
                      >
                        Ver ficha
                      </Link>
                    </div>
                  </article>
                </Popup>
              </Marker>
            )
          })}
        </MarkerClusterGroup>
      </MapContainer>
      {tileError && (
        <p role="alert">
          No se pudieron cargar los mapas. La lista sigue disponible.
        </p>
      )}
    </div>
  )
}
