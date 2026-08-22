import { useMutation, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { api, resolveApiAssetUrl } from '../../services/api'
import type { Publication } from '../../types'
import { usePendingImages } from './usePendingImages'

const maximumImages = 6
export function ImagePicker({
  pending,
  disabled = false,
}: {
  pending: ReturnType<typeof usePendingImages>
  disabled?: boolean
}) {
  const inputId = React.useId()
  return (
    <fieldset className="image-picker" disabled={disabled}>
      <legend>Imágenes</legend>
      <label htmlFor={inputId}>Seleccionar imágenes</label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(event) => {
          if (event.target.files) pending.add(event.target.files)
          event.target.value = ''
        }}
      />
      <small>JPEG, PNG o WebP. Hasta 6 imágenes y 8 MiB por imagen.</small>
      <p className="image-count" aria-live="polite">
        {pending.images.length} de {pending.capacity} seleccionadas
      </p>
      {pending.errors.length > 0 && (
        <ul className="image-errors" role="alert">
          {pending.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {pending.images.length > 0 && (
        <ol className="preview-grid" aria-label="Imágenes seleccionadas">
          {pending.images.map((image, index) => (
            <li key={image.id}>
              <img src={image.previewUrl} alt={`Vista previa ${index + 1}`} />
              <span>{index === 0 ? 'Principal' : `Posición ${index + 1}`}</span>
              <div className="image-actions">
                <button
                  type="button"
                  className="secondary compact"
                  disabled={index === 0}
                  onClick={() => pending.move(image.id, -1)}
                  aria-label={`Mover ${image.file.name} a la izquierda`}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="secondary compact"
                  disabled={index === pending.images.length - 1}
                  onClick={() => pending.move(image.id, 1)}
                  aria-label={`Mover ${image.file.name} a la derecha`}
                >
                  →
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={index === 0}
                  onClick={() => pending.makePrimary(image.id)}
                >
                  Hacer principal
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => pending.remove(image.id)}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </fieldset>
  )
}

export function PublicationGallery({
  publication,
}: {
  publication: Publication
}) {
  const ordered = React.useMemo(
    () => [...publication.images].sort((a, b) => a.position - b.position),
    [publication.images],
  )
  const [selectedId, setSelectedId] = React.useState(ordered[0]?.id)
  const [brokenId, setBrokenId] = React.useState<string>()
  const selected =
    ordered.find((image) => image.id === selectedId) ?? ordered[0]

  if (!selected) return <ImagePlaceholder />
  const name = publication.animal.name ?? publication.title
  return (
    <section className="gallery" aria-label={`Galería de ${name}`}>
      {brokenId === selected.id ? (
        <ImagePlaceholder />
      ) : (
        <div className="gallery-main">
          <img
            src={resolveApiAssetUrl(selected.url)}
            alt={`Imagen de ${name}`}
            width={selected.width ?? undefined}
            height={selected.height ?? undefined}
            onError={() => setBrokenId(selected.id)}
          />
        </div>
      )}
      {ordered.length > 1 && (
        <div
          className="gallery-thumbnails"
          role="group"
          aria-label="Elegir imagen"
        >
          {ordered.map((image, index) => (
            <button
              type="button"
              key={image.id}
              className={image.id === selected.id ? 'selected' : ''}
              aria-label={`Mostrar imagen ${index + 1} de ${name}`}
              aria-pressed={image.id === selected.id}
              onClick={() => {
                setBrokenId(undefined)
                setSelectedId(image.id)
              }}
            >
              <img
                src={resolveApiAssetUrl(image.thumbnailUrl)}
                alt=""
                loading="lazy"
              />
              {image.id === selected.id && <span>Seleccionada</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function ImagePlaceholder() {
  return (
    <div className="placeholder detail-image" aria-label="Imagen no disponible">
      <span aria-hidden="true">🐾</span>
      <p>Imagen no disponible</p>
    </div>
  )
}

export function OwnerImageManager({
  publication,
}: {
  publication: Publication
}) {
  const client = useQueryClient()
  const pending = usePendingImages(maximumImages - publication.images.length)
  const canArrange = publication.status !== 'ARCHIVED'
  const [feedback, setFeedback] = React.useState('')
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['publication', publication.id] }),
      client.invalidateQueries({ queryKey: ['my-publications'] }),
      client.invalidateQueries({ queryKey: ['publications'] }),
    ])
  }
  const upload = useMutation({
    mutationFn: () =>
      api.uploadPublicationImages(
        publication.id,
        pending.images.map((image) => image.file),
      ),
    onSuccess: async () => {
      pending.clear()
      setFeedback('Imágenes añadidas correctamente.')
      await invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: (imageId: string) =>
      api.deletePublicationImage(publication.id, imageId),
    onSuccess: async () => {
      setFeedback('Imagen eliminada.')
      await invalidate()
    },
  })
  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      api.reorderPublicationImages(publication.id, ids),
    onSuccess: async () => {
      setFeedback('Orden de imágenes actualizado.')
      await invalidate()
    },
  })
  const ordered = [...publication.images].sort(
    (a, b) => a.position - b.position,
  )
  const reorderTo = (imageId: string, direction: -1 | 1 | 'primary') => {
    const next =
      direction === 'primary'
        ? moveToStart(ordered, imageId)
        : moveItem(ordered, imageId, direction)
    reorder.mutate(next.map((image) => image.id))
  }
  const busy = upload.isPending || remove.isPending || reorder.isPending
  const error = upload.error ?? remove.error ?? reorder.error

  return (
    <section className="owner-images" aria-labelledby="owner-images-title">
      <h2 id="owner-images-title">Gestionar imágenes</h2>
      <p>{publication.images.length} de 6 imágenes guardadas.</p>
      {canArrange && publication.images.length < maximumImages && (
        <>
          <ImagePicker pending={pending} disabled={busy} />
          <button
            type="button"
            disabled={busy || pending.images.length === 0}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? 'Subiendo…' : 'Añadir imágenes'}
          </button>
        </>
      )}
      {canArrange && publication.images.length >= maximumImages && (
        <p role="status">Has alcanzado el máximo de 6 imágenes.</p>
      )}
      {ordered.length > 0 && (
        <ol className="managed-images">
          {ordered.map((image, index) => (
            <li key={image.id}>
              <img
                src={resolveApiAssetUrl(image.thumbnailUrl)}
                alt={`Imagen ${index + 1} de la publicación`}
              />
              <strong>
                {index === 0 ? 'Principal' : `Posición ${index + 1}`}
              </strong>
              <div className="image-actions">
                {canArrange && (
                  <>
                    <button
                      type="button"
                      className="secondary compact"
                      disabled={busy || index === 0}
                      aria-label={`Mover imagen ${index + 1} a la izquierda`}
                      onClick={() => reorderTo(image.id, -1)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="secondary compact"
                      disabled={busy || index === ordered.length - 1}
                      aria-label={`Mover imagen ${index + 1} a la derecha`}
                      onClick={() => reorderTo(image.id, 1)}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy || index === 0}
                      onClick={() => reorderTo(image.id, 'primary')}
                    >
                      Hacer principal
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('¿Eliminar esta imagen?'))
                      remove.mutate(image.id)
                  }}
                >
                  {remove.isPending && remove.variables === image.id
                    ? 'Eliminando…'
                    : 'Eliminar'}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {feedback && <p role="status">{feedback}</p>}
      {error && (
        <p className="alert" role="alert">
          {error.message}
        </p>
      )}
    </section>
  )
}

function moveItem<T extends { id: string }>(
  items: readonly T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const next = [...items]
  const index = next.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return next
  const [item] = next.splice(index, 1)
  if (item) next.splice(target, 0, item)
  return next
}

function moveToStart<T extends { id: string }>(
  items: readonly T[],
  id: string,
): T[] {
  const next = [...items]
  const index = next.findIndex((item) => item.id === id)
  if (index <= 0) return next
  const [item] = next.splice(index, 1)
  if (item) next.unshift(item)
  return next
}
