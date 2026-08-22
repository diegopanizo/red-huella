import type { MapPublicationRecord } from '../repositories/contracts/publication.repository.js'

export function toMapPublicationDto(value: MapPublicationRecord) {
  return {
    id: value.id,
    type: value.type,
    status: value.status,
    title: value.title,
    eventDate: value.eventDate,
    publicLocation: {
      lat: value.publicLocation.latitude,
      long: value.publicLocation.longitude,
      radius: value.publicLocationRadiusMeters,
    },
    animal: {
      name: value.animalName,
      species: value.species,
      breed: value.breed,
    },
    thumbnail:
      value.thumbnailId === null ||
      value.thumbnailWidth === null ||
      value.thumbnailHeight === null
        ? null
        : {
            url: `/api/v1/publication-images/${value.thumbnailId}/thumbnail`,
            width: value.thumbnailWidth,
            height: value.thumbnailHeight,
          },
  }
}

export type MapPublicationDto = ReturnType<typeof toMapPublicationDto>
