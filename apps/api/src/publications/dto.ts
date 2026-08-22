import type { PublicationAggregate } from '../repositories/contracts/publication.repository.js'
import { toPublicImageDto } from '../images/image-dto.js'
import { roundPublicDistanceMeters } from '../locations/public-distance.js'

export function toPublicPublicationDto(value: PublicationAggregate) {
  const { publication, animal, author, images } = value
  return {
    id: publication.id,
    type: publication.type,
    title: publication.title,
    description: publication.description,
    status: publication.status,
    eventDate: publication.eventDate,
    publicLocation:
      publication.publicLocation === null ||
      publication.publicLocation === undefined ||
      publication.publicLocationRadiusMeters === null ||
      publication.publicLocationRadiusMeters === undefined
        ? null
        : {
            latitude: publication.publicLocation.latitude,
            longitude: publication.publicLocation.longitude,
            radiusMeters: publication.publicLocationRadiusMeters,
          },
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
    images: images.map(toPublicImageDto),
    ...(value.distanceMeters !== undefined
      ? { distanceMeters: roundPublicDistanceMeters(value.distanceMeters) }
      : {}),
  }
}

export function toManagePublicationDto(value: PublicationAggregate) {
  const publicDto = toPublicPublicationDto(value)
  return {
    ...publicDto,
    exactLocation: value.publication.exactLocation,
  }
}

export type PublicPublicationDto = ReturnType<typeof toPublicPublicationDto>
export type ManagePublicationDto = ReturnType<typeof toManagePublicationDto>
