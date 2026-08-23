import React from 'react'
import { Link } from 'react-router-dom'

import { ApiError, resolveApiAssetUrl } from '../../services/api'
import type { PublicationType, VisualSearchResult } from '../../types'
import { useVisualSearch } from './useVisualSearch'

const labels = {
  LOST: 'Perdido',
  FOUND: 'Encontrado',
  ADOPTION: 'Adopción',
  DOG: 'Perro',
  CAT: 'Gato',
  OTHER: 'Otro',
} as const
const errorMessage = (error: unknown) => {
  if (error instanceof Error && !(error instanceof ApiError))
    return error.message
  if (!(error instanceof ApiError)) return 'No se pudo completar la búsqueda.'
  if (error.status === 400)
    return 'No pudimos usar esta imagen. Prueba con JPEG, PNG o WebP.'
  if (error.status === 429)
    return 'Has realizado varias búsquedas seguidas. Inténtalo de nuevo más tarde.'
  if (error.status === 503)
    return 'La búsqueda por foto no está disponible temporalmente.'
  return 'No se pudo completar la búsqueda.'
}
const readableSize = (bytes: number) =>
  `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`

function ResultCard({ result }: { result: VisualSearchResult }) {
  const [broken, setBroken] = React.useState(false)
  const item = result.publication
  return (
    <article className="card visual-result-card">
      {!broken ? (
        <div className="visual-result-image">
          <img
            src={resolveApiAssetUrl(result.matchedImage.thumbnailUrl)}
            alt={`Foto visualmente similar de ${item.animal.name ?? item.title}`}
            onError={() => setBroken(true)}
          />
          <span>Foto visualmente similar</span>
        </div>
      ) : (
        <div className="placeholder" aria-label="Imagen no disponible">
          <span aria-hidden="true">🐾</span>
        </div>
      )}
      <div className="card-body">
        <div className="badges">
          <span className={`badge ${item.type.toLowerCase()}`}>
            {labels[item.type]}
          </span>
          <span className="badge neutral">Similitud visual</span>
        </div>
        <h2>{item.animal.name ?? item.title}</h2>
        <p>{item.title}</p>
        <p className="card-taxonomy">
          {[labels[item.animal.species], item.animal.breed?.trim()]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="card-secondary">
          {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
            new Date(item.eventDate),
          )}
        </p>
        {item.publicLocation && (
          <div className="card-location">
            <span>Zona aproximada protegida</span>
          </div>
        )}
        <div className="card-actions">
          <Link className="button" to={`/publications/${item.id}`}>
            Ver publicación
          </Link>
        </div>
      </div>
    </article>
  )
}

export function VisualSearchPage() {
  const search = useVisualSearch()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [targetType, setTargetType] = React.useState<'' | PublicationType>('')
  const [species, setSpecies] = React.useState<'' | 'DOG' | 'CAT' | 'OTHER'>('')
  const choose = (files: FileList | null) => {
    const file = files?.[0]
    if (file) search.selectFile(file)
  }
  const submit = () =>
    void search.search({
      ...(targetType ? { targetType } : {}),
      ...(species ? { species } : {}),
      limit: 20,
    })
  return (
    <section
      className="visual-search-page"
      aria-labelledby="visual-search-title"
    >
      <p className="eyebrow">Exploración visual</p>
      <h1 id="visual-search-title">Buscar por foto</h1>
      <p className="lead">
        Encuentra publicaciones con animales visualmente similares.
      </p>
      <div className="visual-search-panel">
        <div
          className={`visual-picker ${search.previewUrl ? 'has-preview' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            choose(event.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            id="visual-search-image"
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={(event) => choose(event.target.files)}
          />
          {search.previewUrl && search.file ? (
            <>
              <img
                src={search.previewUrl}
                alt="Vista previa de la foto seleccionada"
              />
              <div>
                <strong title={search.file.name}>{search.file.name}</strong>
                <span>{readableSize(search.file.size)}</span>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => inputRef.current?.click()}
              >
                Cambiar foto
              </button>
            </>
          ) : (
            <label htmlFor="visual-search-image">
              <strong>Selecciona o arrastra una foto</strong>
              <span>JPEG, PNG o WebP · máximo 8 MB</span>
            </label>
          )}
        </div>
        <p className="visual-privacy">
          La foto se utiliza para realizar la búsqueda y no se añade a ninguna
          publicación.
        </p>
        {search.file && (
          <div className="visual-search-controls">
            <label>
              Buscar entre
              <select
                value={targetType}
                onChange={(event) =>
                  setTargetType(event.target.value as '' | PublicationType)
                }
              >
                <option value="">Perdidos y encontrados</option>
                <option value="LOST">Solo perdidos</option>
                <option value="FOUND">Solo encontrados</option>
                <option value="ADOPTION">Adopción</option>
              </select>
            </label>
            <label>
              Especie
              <select
                value={species}
                onChange={(event) =>
                  setSpecies(event.target.value as typeof species)
                }
              >
                <option value="">Todas</option>
                <option value="DOG">Perro</option>
                <option value="CAT">Gato</option>
                <option value="OTHER">Otra</option>
              </select>
            </label>
            <button
              type="button"
              disabled={search.state === 'loading'}
              onClick={submit}
            >
              {search.state === 'loading'
                ? 'Buscando publicaciones similares…'
                : 'Buscar similares'}
            </button>
          </div>
        )}
        <div aria-live="polite">
          {search.state === 'loading' && (
            <p className="loading">Buscando publicaciones similares…</p>
          )}
          {search.state === 'error' && (
            <div className="alert" role="alert">
              <p>{errorMessage(search.error)}</p>
              {search.file && (
                <button type="button" onClick={submit}>
                  Intentar de nuevo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {search.state === 'success' && (
        <section
          className="visual-results"
          aria-labelledby="visual-results-title"
        >
          <div className="section-title">
            <div>
              <h2 id="visual-results-title">
                Resultados visualmente similares
              </h2>
              <p aria-live="polite">
                {search.results.length}{' '}
                {search.results.length === 1
                  ? 'publicación encontrada'
                  : 'publicaciones encontradas'}
                .
              </p>
            </div>
            <button type="button" className="secondary" onClick={search.reset}>
              Nueva búsqueda
            </button>
          </div>
          <p className="visual-disclaimer">
            La similitud visual sirve para encontrar candidatos y no confirma
            que sea el mismo animal.
          </p>
          {search.results.length ? (
            <div className="grid visual-results-grid">
              {search.results.map((result) => (
                <ResultCard key={result.publication.id} result={result} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <span aria-hidden="true">🐾</span>
              <p>No encontramos publicaciones visualmente similares.</p>
              <p>
                Prueba otra foto, quita el filtro de especie o busca entre
                perdidos y encontrados.
              </p>
            </div>
          )}
        </section>
      )}
    </section>
  )
}
