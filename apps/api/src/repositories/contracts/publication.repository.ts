import type {
  PublicationStatus,
  PublicationType,
} from '../../database/schema/enums.js'
import type { PublicationRecord } from '../../database/schema/publications.js'
import type { AnimalRecord } from '../../database/schema/animals.js'
import type { PublicationImageRecord } from '../../database/schema/publication-images.js'
import type { UserRole, Species } from '../../database/schema/enums.js'
import type { CreateAnimalData, UpdateAnimalData } from './animal.repository.js'
import type {
  ExactLocation,
  PublicLocation,
} from '../../locations/location-types.js'

export interface CreatePublicationData {
  userId: string
  animalId: string
  type: PublicationType
  title: string
  description?: string | null
  status?: PublicationStatus
  eventDate: Date
  latitude?: number | null
  longitude?: number | null
  exactLocation?: ExactLocation | null
  publicLocation?: PublicLocation | null
  locationPrivacyVersion?: number | null
  resolvedAt?: Date | null
}

export interface PublicationRepository {
  findById(id: string): Promise<PublicationRecord | undefined>
  create(data: CreatePublicationData): Promise<PublicationRecord>
  createWithAnimal(
    data: Omit<CreatePublicationData, 'animalId'>,
    animal: CreateAnimalData,
  ): Promise<PublicationAggregate>
  findAggregateById(id: string): Promise<PublicationAggregate | undefined>
  findManageAggregateById(id: string): Promise<PublicationAggregate | undefined>
  findMany(
    query: PublicationListQuery,
  ): Promise<{ items: PublicationAggregate[]; total: number }>
  findForMapViewport(
    query: MapPublicationQuery,
  ): Promise<MapPublicationRecord[]>
  updateWithAnimal(
    id: string,
    publication: UpdatePublicationData,
    animal: UpdateAnimalData | undefined,
  ): Promise<PublicationAggregate>
  updateStatus(
    id: string,
    status: PublicationStatus,
    resolvedAt: Date | null,
    updatedAt: Date,
  ): Promise<PublicationAggregate>
  findLegacyLocationsForBackfill(
    limit: number,
    afterId?: string | undefined,
  ): Promise<LegacyLocationRow[]>
  updateLocationModel(
    id: string,
    location: LocationPersistenceData,
  ): Promise<void>
}

export interface MapPublicationQuery {
  north: number
  south: number
  west: number
  east: number
  type?: PublicationType | undefined
  status: Exclude<PublicationStatus, 'ARCHIVED'>
  species?: Species | undefined
}

export interface MapPublicationRecord {
  id: string
  type: PublicationType
  status: Exclude<PublicationStatus, 'ARCHIVED'>
  title: string
  eventDate: Date
  publicLocation: PublicLocation
  publicLocationRadiusMeters: number
  animalName: string | null
  species: Species
  breed: string | null
  thumbnailId: string | null
  thumbnailWidth: number | null
  thumbnailHeight: number | null
}

export interface PublicationAggregate {
  publication: PublicationRecord
  animal: AnimalRecord
  author: { id: string; name: string; role: UserRole }
  images: PublicationImageRecord[]
  distanceMeters?: number | undefined
}

export interface PublicationListQuery {
  page: number
  pageSize: number
  type?: PublicationType | undefined
  status?: PublicationStatus | undefined
  species?: Species | undefined
  order: 'newest' | 'oldest' | 'eventDate' | 'distance'
  latitude?: number | undefined
  longitude?: number | undefined
  radiusMeters?: number | undefined
  ownerId?: string
  includeArchived?: boolean
}

export interface UpdatePublicationData {
  type?: PublicationType
  title?: string
  description?: string | null
  eventDate?: Date
  latitude?: number | null
  longitude?: number | null
  exactLocation?: ExactLocation | null
  publicLocation?: PublicLocation | null
  locationPrivacyVersion?: number | null
  updatedAt: Date
}

export interface LocationPersistenceData {
  exactLocation: ExactLocation | null
  publicLocation: PublicLocation | null
  locationPrivacyVersion: number | null
  clearLegacy: boolean
}

export interface LegacyLocationRow {
  id: string
  type: PublicationType
  latitude: number
  longitude: number
  publicLocation: PublicLocation | null
  locationPrivacyVersion: number | null
}
