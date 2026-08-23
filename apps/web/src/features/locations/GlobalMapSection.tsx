import { keepPreviousData, useQuery } from '@tanstack/react-query'
import React from 'react'
import { Link } from 'react-router-dom'

import { api, ApiError, resolveApiAssetUrl } from '../../services/api'
import type {
  MapBounds,
  MapPublication,
  MapPublicationsResponse,
  PublicationStatus,
  PublicationType,
} from '../../types'
import { GlobalPublicationsMap } from './GlobalPublicationsMap'
import { mapBoundsEqual } from './map-bounds'
import { DEMO_SPAIN_INITIAL_BOUNDS } from './map-config'
import { nearbyMapAreaToBounds, type NearbyMapArea } from './nearby-map-area'

export interface GlobalMapFilters {
  type?: PublicationType | undefined
  species?: 'DOG' | 'CAT' | 'OTHER' | undefined
  status?: Exclude<PublicationStatus, 'ARCHIVED'> | undefined
}

const typeLabels = {
  LOST: 'Perdido',
  FOUND: 'Encontrado',
  ADOPTION: 'Adopción',
} as const
const speciesLabels = { DOG: 'Perro', CAT: 'Gato', OTHER: 'Otro' } as const
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(value),
  )

const MOBILE_MAP_QUERY = '(max-width: 800px)'

function useMobileMapLayout(): boolean {
  const [mobile, setMobile] = React.useState(
    () => window.matchMedia?.(MOBILE_MAP_QUERY).matches ?? false,
  )
  React.useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia(MOBILE_MAP_QUERY)
    const update = (event: MediaQueryListEvent) => setMobile(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

function MiniThumbnail({ publication }: { publication: MapPublication }) {
  const [broken, setBroken] = React.useState(false)
  return publication.thumbnail && !broken ? (
    <img
      src={resolveApiAssetUrl(publication.thumbnail.url)}
      width={publication.thumbnail.width}
      height={publication.thumbnail.height}
      alt=""
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

export function GlobalMapSection({
  filters,
  nearbyArea = null,
}: {
  filters: GlobalMapFilters
  nearbyArea?: NearbyMapArea | null
}) {
  const mobileLayout = useMobileMapLayout()
  const [mobileView, setMobileView] = React.useState<'list' | 'map'>('list')
  const [appliedBounds, setAppliedBounds] = React.useState<MapBounds | null>(
    null,
  )
  const [pendingZone, setPendingZone] = React.useState<{
    bounds: MapBounds
    nearbyScope: string | null
  } | null>(null)
  const [retainedData, setRetainedData] =
    React.useState<MapPublicationsResponse | null>(null)
  const [selection, setSelection] = React.useState<{
    id: string
    scope: string
  } | null>(null)
  const nearbyBounds = React.useMemo(
    () => (nearbyArea ? nearbyMapAreaToBounds(nearbyArea) : null),
    [nearbyArea],
  )
  const nearbyScope = nearbyArea
    ? `${nearbyArea.latitude}:${nearbyArea.longitude}:${nearbyArea.radiusMeters}`
    : null
  const [customMapZoneScope, setCustomMapZoneScope] = React.useState<
    string | null
  >(null)
  const usesCustomMapZone =
    nearbyScope !== null && customMapZoneScope === nearbyScope
  const effectiveAppliedBounds =
    nearbyBounds && !usesCustomMapZone ? nearbyBounds : appliedBounds
  const effectivePendingBounds =
    nearbyBounds &&
    !usesCustomMapZone &&
    pendingZone?.nearbyScope !== nearbyScope
      ? nearbyBounds
      : (pendingZone?.bounds ?? null)
  const mapZone = nearbyArea
    ? usesCustomMapZone
      ? 'custom'
      : 'nearby'
    : 'default'
  const captureInitialBounds = React.useCallback(
    (bounds: MapBounds) => {
      setAppliedBounds((current) => current ?? bounds)
      setPendingZone({ bounds, nearbyScope })
    },
    [nearbyScope],
  )
  const itemRefs = React.useRef(new Map<string, HTMLElement>())
  const selectionScope = JSON.stringify({ effectiveAppliedBounds, filters })
  const selectedPublicationId =
    selection?.scope === selectionScope ? selection.id : null
  const selectPublication = (id: string) => {
    setSelection({ id, scope: selectionScope })
    if (mobileLayout) setMobileView('map')
  }
  const result = useQuery({
    queryKey: ['map-publications', effectiveAppliedBounds, filters],
    queryFn: ({ signal }) => {
      if (!effectiveAppliedBounds) throw new Error('Map bounds are not ready')
      return api.getMapPublications(effectiveAppliedBounds, filters, signal)
    },
    enabled: effectiveAppliedBounds !== null,
    placeholderData: keepPreviousData,
  })
  React.useEffect(() => {
    if (selectedPublicationId)
      itemRefs.current
        .get(selectedPublicationId)
        ?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedPublicationId])
  const displayedData = result.data ?? retainedData
  const publications = displayedData?.publications ?? []
  const limited =
    result.error instanceof ApiError && result.error.status === 429
  const boundsChanged = !mapBoundsEqual(
    effectiveAppliedBounds,
    effectivePendingBounds,
  )
  const canRetryFailedZone = result.isError && displayedData !== null
  const showSearchAction =
    boundsChanged ||
    canRetryFailedZone ||
    (result.isFetching && displayedData !== null)
  const applyPendingBounds = () => {
    if (displayedData) setRetainedData(displayedData)
    if (boundsChanged && effectivePendingBounds) {
      setAppliedBounds(effectivePendingBounds)
      if (nearbyScope) setCustomMapZoneScope(nearbyScope)
    } else void result.refetch()
  }
  return (
    <>
      {displayedData?.truncated && (
        <p className="map-truncated" role="status">
          Hay demasiados resultados en esta zona. Acerca el mapa o aplica
          filtros para ver más.
        </p>
      )}
      <p className="map-privacy-legend">
        Las ubicaciones mostradas son aproximadas para proteger la privacidad.
      </p>
      {nearbyArea && mapZone === 'nearby' && (
        <p className="map-nearby-context" role="status">
          Mapa centrado en tu zona de búsqueda de{' '}
          {nearbyArea.radiusMeters / 1000} km.
        </p>
      )}
      {nearbyArea && mapZone === 'custom' && (
        <p className="map-nearby-context" role="status">
          El listado sigue filtrado Cerca de mí; el mapa muestra la zona que
          elegiste.
        </p>
      )}
      {mobileLayout && (
        <div
          className="mobile-map-view-switch"
          role="group"
          aria-label="Vista de publicaciones geográficas"
        >
          <button
            type="button"
            aria-controls="global-map-list"
            aria-pressed={mobileView === 'list'}
            onClick={() => setMobileView('list')}
          >
            Lista
          </button>
          <button
            type="button"
            aria-controls="global-map-panel"
            aria-pressed={mobileView === 'map'}
            onClick={() => setMobileView('map')}
          >
            Mapa
          </button>
        </div>
      )}
      <div className="global-map-layout">
        <div
          id="global-map-list"
          className="map-mini-list"
          aria-label="Publicaciones mostradas en el mapa"
          hidden={mobileLayout && mobileView !== 'list'}
        >
          {result.isError && (
            <p className="alert map-update-error" role="alert">
              {limited
                ? 'Has realizado demasiadas búsquedas en el mapa. Inténtalo nuevamente en un momento.'
                : displayedData
                  ? 'No pudimos actualizar esta zona del mapa. Se mantienen los resultados de la última zona cargada.'
                  : 'No pudimos cargar las publicaciones del mapa.'}
            </p>
          )}
          {!effectiveAppliedBounds || (result.isLoading && !displayedData) ? (
            <p className="loading" aria-live="polite">
              Cargando mapa de publicaciones…
            </p>
          ) : publications.length === 0 ? (
            <p>No hay publicaciones para estos filtros.</p>
          ) : (
            publications.map((publication) => {
              const selected = publication.id === selectedPublicationId
              return (
                <article
                  key={publication.id}
                  ref={(element) => {
                    if (element) itemRefs.current.set(publication.id, element)
                    else itemRefs.current.delete(publication.id)
                  }}
                  className={`map-mini-card${selected ? ' selected' : ''}`}
                  data-publication-id={publication.id}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectPublication(publication.id)}
                  >
                    <MiniThumbnail publication={publication} />
                    <span>
                      <strong>
                        {publication.animal.name ?? publication.title}
                      </strong>
                      {publication.animal.name && (
                        <span>{publication.title}</span>
                      )}
                      <span>
                        {typeLabels[publication.type]} ·{' '}
                        {speciesLabels[publication.animal.species]}
                        {publication.animal.breed?.trim()
                          ? ` · ${publication.animal.breed}`
                          : ''}
                      </span>
                      <span>{formatDate(publication.eventDate)}</span>
                    </span>
                  </button>
                  <Link to={`/publications/${publication.id}`}>Ver ficha</Link>
                </article>
              )
            })
          )}
        </div>
        <div
          id="global-map-panel"
          className="interactive-map-panel"
          hidden={mobileLayout && mobileView !== 'map'}
        >
          {showSearchAction && (
            <div className="map-search-area" role="status">
              {boundsChanged && (
                <span>
                  El mapa se movió. Busca en esta zona para actualizar
                  resultados.
                </span>
              )}
              <button
                type="button"
                onClick={applyPendingBounds}
                disabled={result.isFetching && !boundsChanged}
              >
                {result.isFetching && !boundsChanged
                  ? 'Buscando…'
                  : 'Buscar en esta zona'}
              </button>
            </div>
          )}
          <GlobalPublicationsMap
            publications={publications}
            selectedPublicationId={selectedPublicationId}
            onSelectPublication={selectPublication}
            onOpenPublication={() => undefined}
            initialBounds={DEMO_SPAIN_INITIAL_BOUNDS}
            focusBounds={usesCustomMapZone ? null : nearbyBounds}
            visible={!mobileLayout || mobileView === 'map'}
            onBoundsChange={captureInitialBounds}
          />
        </div>
      </div>
    </>
  )
}
