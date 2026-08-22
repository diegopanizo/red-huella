import type {
  PublicationStatus,
  PublicationType,
} from '../../database/schema/enums.js'
import type { PublicationRecord } from '../../database/schema/publications.js'
import type { AnimalRecord } from '../../database/schema/animals.js'
import type { PublicationImageRecord } from '../../database/schema/publication-images.js'
import type { UserRole, Species } from '../../database/schema/enums.js'
import type { CreateAnimalData, UpdateAnimalData } from './animal.repository.js'

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
  findMany(
    query: PublicationListQuery,
  ): Promise<{ items: PublicationAggregate[]; total: number }>
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
}

export interface PublicationAggregate {
  publication: PublicationRecord
  animal: AnimalRecord
  author: { id: string; name: string; role: UserRole }
  images: PublicationImageRecord[]
}

export interface PublicationListQuery {
  page: number
  pageSize: number
  type?: PublicationType | undefined
  status?: PublicationStatus | undefined
  species?: Species | undefined
  order: 'newest' | 'oldest' | 'eventDate'
  ownerId?: string
  includeArchived?: boolean
}

export interface UpdatePublicationData {
  title?: string
  description?: string | null
  eventDate?: Date
  latitude?: number | null
  longitude?: number | null
  updatedAt: Date
}
