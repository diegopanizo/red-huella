import React from 'react'

const maximumImages = 6
const maximumBytes = 8 * 1024 * 1024
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface PendingImage {
  id: string
  file: File
  previewUrl: string
}

export function usePendingImages(capacity = maximumImages) {
  const [images, setImages] = React.useState<PendingImage[]>([])
  const [errors, setErrors] = React.useState<string[]>([])
  const imagesRef = React.useRef(images)

  React.useEffect(() => {
    imagesRef.current = images
  }, [images])
  React.useEffect(
    () => () => {
      for (const image of imagesRef.current)
        URL.revokeObjectURL(image.previewUrl)
    },
    [],
  )

  const add = (files: FileList | readonly File[]) => {
    const accepted: PendingImage[] = []
    const nextErrors: string[] = []
    for (const file of Array.from(files)) {
      if (images.length + accepted.length >= capacity) {
        nextErrors.push(`Solo puedes seleccionar ${capacity} imágenes.`)
        break
      }
      if (!allowedTypes.has(file.type)) {
        nextErrors.push(`${file.name}: formato no admitido.`)
        continue
      }
      if (file.size > maximumBytes) {
        nextErrors.push(`${file.name}: supera el límite de 8 MiB.`)
        continue
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    setErrors(nextErrors)
    if (accepted.length) setImages((current) => [...current, ...accepted])
  }

  const remove = (id: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((image) => image.id !== id)
    })
  }
  const move = (id: string, direction: -1 | 1) =>
    setImages((current) => moveItem(current, id, direction))
  const makePrimary = (id: string) =>
    setImages((current) => moveToStart(current, id))
  const clear = () => {
    for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl)
    setImages([])
    setErrors([])
  }
  return { images, errors, capacity, add, remove, move, makePrimary, clear }
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
