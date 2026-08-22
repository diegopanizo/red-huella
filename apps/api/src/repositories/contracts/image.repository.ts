import type {
  PublicationImageRecord,
  StorageDeletionJobRecord,
} from '../../database/schema/publication-images.js'
import type { PublicationStatus } from '../../database/schema/enums.js'

export interface NewImageMetadata {
  id: string
  storageKey: string
  thumbnailStorageKey: string
  mimeType: 'image/webp'
  displayWidth: number
  displayHeight: number
  displayByteSize: number
  displayChecksumSha256: string
  thumbnailWidth: number
  thumbnailHeight: number
  thumbnailByteSize: number
  thumbnailChecksumSha256: string
}

export type ImageMutationFailure =
  'not_found' | 'forbidden' | 'status_not_allowed'

export type InsertImagesResult =
  | { outcome: 'inserted'; images: PublicationImageRecord[] }
  | { outcome: ImageMutationFailure | 'too_many' }

export type DeleteImageResult =
  | { outcome: 'deleted'; jobs: StorageDeletionJobRecord[] }
  | { outcome: 'not_found' | 'forbidden' }

export type ReorderImagesResult =
  | { outcome: 'reordered'; images: PublicationImageRecord[] }
  | { outcome: ImageMutationFailure | 'invalid_order' }

export interface ImageContentRecord {
  image: PublicationImageRecord
  publicationStatus: PublicationStatus
  ownerId: string
}

export interface ImageRepository {
  listByPublication(publicationId: string): Promise<PublicationImageRecord[]>
  insertWithCapacity(input: {
    publicationId: string
    ownerId: string
    allowedStatuses: readonly PublicationStatus[]
    maximumImages: number
    images: readonly NewImageMetadata[]
  }): Promise<InsertImagesResult>
  deleteWithOutbox(input: {
    publicationId: string
    imageId: string
    ownerId: string
  }): Promise<DeleteImageResult>
  reorder(input: {
    publicationId: string
    ownerId: string
    allowedStatuses: readonly PublicationStatus[]
    imageIds: readonly string[]
  }): Promise<ReorderImagesResult>
  findContentById(imageId: string): Promise<ImageContentRecord | undefined>
  findPendingDeletionJobs(limit: number): Promise<StorageDeletionJobRecord[]>
  markDeletionJobCompleted(id: string, completedAt: Date): Promise<void>
  markDeletionJobFailed(
    id: string,
    nextAttemptAt: Date,
    message: string,
  ): Promise<void>
}
