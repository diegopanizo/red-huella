import type { PublicationImageRecord } from '../database/schema/publication-images.js'

export function toPublicImageDto(image: PublicationImageRecord) {
  const baseUrl = `/api/v1/publication-images/${image.id}`
  return {
    id: image.id,
    position: image.position,
    url: `${baseUrl}/content`,
    thumbnailUrl: `${baseUrl}/thumbnail`,
    width: image.displayWidth,
    height: image.displayHeight,
  }
}

export type PublicImageDto = ReturnType<typeof toPublicImageDto>
