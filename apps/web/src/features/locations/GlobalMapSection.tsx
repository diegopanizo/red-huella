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

export function GlobalMapSection({ filters }: { filters: GlobalMapFilters }) {
  const [appliedBounds, setAppliedBounds] = React.useState<MapBounds | null>(
    null,
  )
  const [pendingBounds, setPendingBounds] = React.useState<MapBounds | null>(
    null,
  )
  const [retainedData, setRetainedData] =
    React.useState<MapPublicationsResponse | null>(null)
  const [selection, setSelection] = React.useState<{
    id: string
    scope: string
  } | null>(null)
  const captureInitialBounds = React.useCallback((bounds: MapBounds) => {
    setAppliedBounds((current) => current ?? bounds)
    setPendingBounds(bounds)
  }, [])
  const itemRefs = React.useRef(new Map<string, HTMLElement>())
  const selectionScope = JSON.stringify({ appliedBounds, filters })
  const selectedPublicationId =
    selection?.scope === selectionScope ? selection.id : null
  const selectPublication = (id: string) =>
    setSelection({ id, scope: selectionScope })
  const result = useQuery({
    queryKey: ['map-publications', appliedBounds, filters],
    queryFn: ({ signal }) => {
      if (!appliedBounds) throw new Error('Map bounds are not ready')
      return api.getMapPublications(appliedBounds, filters, signal)
    },
    enabled: appliedBounds !== null,
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
  const boundsChanged = !mapBoundsEqual(appliedBounds, pendingBounds)
  const canRetryFailedZone = result.isError && displayedData !== null
  const showSearchAction =
    boundsChanged ||
    canRetryFailedZone ||
    (result.isFetching && displayedData !== null)
  const applyPendingBounds = () => {
    if (displayedData) setRetainedData(displayedData)
    if (boundsChanged && pendingBounds) setAppliedBounds(pendingBounds)
    else void result.refetch()
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
      <div className="global-map-layout">
        <div
          className="map-mini-list"
          aria-label="Publicaciones mostradas en el mapa"
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
          {!appliedBounds || (result.isLoading && !displayedData) ? (
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
        <div className="interactive-map-panel">
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
            onBoundsChange={captureInitialBounds}
          />
        </div>
      </div>
    </>
  )
}
