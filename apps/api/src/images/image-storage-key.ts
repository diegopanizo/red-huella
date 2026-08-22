import { randomUUID } from 'node:crypto'

import type { ImageStorageKeys } from './image-storage.js'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const storageKeyPattern =
  /^publications\/([^/]+)\/([^/]+)\/(display|thumbnail)\.webp$/

function assertUuid(value: string, field: string): void {
  if (!uuidPattern.test(value)) {
    throw new Error(`${field} debe ser un UUID valido`)
  }
}

export function createImageStorageKeys(
  publicationId: string,
  imageId: string = randomUUID(),
): ImageStorageKeys & { readonly imageId: string } {
  assertUuid(publicationId, 'publicationId')
  assertUuid(imageId, 'imageId')
  const prefix = `publications/${publicationId}/${imageId}`
  return {
    imageId,
    display: `${prefix}/display.webp`,
    thumbnail: `${prefix}/thumbnail.webp`,
  }
}

export function assertValidImageStorageKey(key: string): void {
  const match = storageKeyPattern.exec(key)
  if (
    !match ||
    !uuidPattern.test(match[1] ?? '') ||
    !uuidPattern.test(match[2] ?? '')
  ) {
    throw new Error('Storage key de imagen no valida')
  }
}
