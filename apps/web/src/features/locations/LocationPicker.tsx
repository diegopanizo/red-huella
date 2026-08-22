import React from 'react'
import { z } from 'zod'

import type { Location, PublicLocation } from '../../types'
import { LocationMap } from './LocationMap'

export type LocationPickerMode = 'exact-owner' | 'reference-zone'

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
})

export function LocationPicker({
  value,
  onChange,
  mode,
  publicZone,
  privacyText,
}: {
  value: Location | null
  onChange: (value: Location | null) => void
  mode: LocationPickerMode
  publicZone?: PublicLocation | null | undefined
  privacyText: string
}) {
  const [latitude, setLatitude] = React.useState(
    value ? String(value.latitude) : '',
  )
  const [longitude, setLongitude] = React.useState(
    value ? String(value.longitude) : '',
  )
  const [manualError, setManualError] = React.useState<string>()
  const [tileError, setTileError] = React.useState(false)
  const [geoStatus, setGeoStatus] = React.useState<'idle' | 'loading'>('idle')
  const [geoError, setGeoError] = React.useState<string>()

  const select = (next: Location) => {
    setManualError(undefined)
    setLatitude(String(next.latitude))
    setLongitude(String(next.longitude))
    onChange(next)
  }
  const remove = () => {
    setLatitude('')
    setLongitude('')
    setManualError(undefined)
    onChange(null)
  }
  const applyManual = () => {
    if (!latitude.trim() && !longitude.trim()) {
      setManualError('Introduce ambas coordenadas o usa Quitar ubicación.')
      return
    }
    if (!latitude.trim() || !longitude.trim()) {
      setManualError('Latitud y longitud deben estar ambas presentes.')
      return
    }
    const next = { latitude: Number(latitude), longitude: Number(longitude) }
    if (!locationSchema.safeParse(next).success) {
      setManualError(
        'Las coordenadas no están dentro de los rangos permitidos.',
      )
      return
    }
    select(next)
  }
  const useGeolocation = () => {
    if (!navigator.geolocation) return
    setGeoStatus('loading')
    setGeoError(undefined)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        select({ latitude: coords.latitude, longitude: coords.longitude })
        setGeoStatus('idle')
      },
      (error) => {
        setGeoStatus('idle')
        setGeoError(
          error.code === 1
            ? 'Permiso de ubicación denegado. Puedes usar el mapa o introducir coordenadas.'
            : error.code === 3
              ? 'La geolocalización tardó demasiado. Puedes intentarlo de nuevo.'
              : 'No se pudo obtener tu ubicación. Puedes usar el mapa o introducir coordenadas.',
        )
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <section
      className="location-picker"
      data-location-mode={mode}
      aria-labelledby="location-heading"
    >
      <h2 id="location-heading">Ubicación</h2>
      <p>{privacyText}</p>
      {publicZone && (
        <p className="location-zone-note">
          Zona aproximada visible públicamente.
        </p>
      )}
      <p className="location-help">
        Pulsa en el mapa o arrastra el marcador. La ubicación es opcional.
      </p>
      <LocationMap
        value={value}
        publicZone={publicZone}
        onChange={select}
        onTileError={() => setTileError(true)}
      />
      {tileError && (
        <p role="alert">
          No se pudieron cargar los mapas. La entrada manual sigue disponible.
        </p>
      )}
      {value && (
        <p className="selected-coordinates" aria-live="polite">
          Coordenadas seleccionadas: {value.latitude.toFixed(6)},{' '}
          {value.longitude.toFixed(6)}
        </p>
      )}
      <div className="location-actions">
        <button
          type="button"
          className="secondary"
          onClick={useGeolocation}
          disabled={!navigator.geolocation || geoStatus === 'loading'}
        >
          {!navigator.geolocation
            ? 'Geolocalización no disponible'
            : geoStatus === 'loading'
              ? 'Obteniendo ubicación…'
              : 'Usar mi ubicación'}
        </button>
        <button type="button" className="secondary" onClick={remove}>
          Quitar ubicación
        </button>
      </div>
      {geoError && <p role="alert">{geoError}</p>}
      <details className="manual-location">
        <summary>Introducir coordenadas manualmente</summary>
        <div className="two">
          <label>
            Latitud
            <input
              aria-label="Latitud manual"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
          </label>
          <label>
            Longitud
            <input
              aria-label="Longitud manual"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className="secondary" onClick={applyManual}>
          Aplicar coordenadas
        </button>
        {manualError && <p role="alert">{manualError}</p>}
      </details>
    </section>
  )
}
