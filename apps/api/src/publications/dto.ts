import type { PublicationAggregate } from '../repositories/contracts/publication.repository.js'

export function toPublicPublicationDto(value: PublicationAggregate) {
  const { publication, animal, author, images } = value
  return {
    id: publication.id,
    type: publication.type,
    title: publication.title,
    description: publication.description,
    status: publication.status,
    eventDate: publication.eventDate,
    location:
      publication.latitude === null
        ? null
        : { latitude: publication.latitude, longitude: publication.longitude },
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt,
    resolvedAt: publication.resolvedAt,
    animal: {
      id: animal.id,
      name: animal.name,
      species: animal.species,
      breed: animal.breed,
      sex: animal.sex,
      color: animal.color,
      size: animal.size,
      approximateAge: animal.approximateAge,
      description: animal.description,
    },
    author,
    images: images.map(({ id, storageKey, position }) => ({
      id,
      storageKey,
      position,
    })),
  }
}

export type PublicPublicationDto = ReturnType<typeof toPublicPublicationDto>
