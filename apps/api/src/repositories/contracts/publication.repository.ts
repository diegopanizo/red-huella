import type {
  PublicationStatus,
  PublicationType,
} from '../../database/schema/enums.js'
import type { PublicationRecord } from '../../database/schema/publications.js'

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
}
