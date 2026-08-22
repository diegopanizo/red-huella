import type { Readable } from 'node:stream'

import type { PublicationStatus } from '../database/schema/enums.js'
import { AppError } from '../errors/app-error.js'
import {
  ImageForbiddenError,
  ImageInvalidOrderError,
  ImageNotFoundError,
  ImageTooManyError,
  ImageUploadEmptyError,
  ImageUploadStatusNotAllowedError,
  StorageOperationError,
} from '../errors/image-errors.js'
import { PublicationNotFoundError } from '../errors/publication-errors.js'
import { toPublicImageDto } from '../images/image-dto.js'
import { createImageStorageKeys } from '../images/image-storage-key.js'
import type {
  ImageProcessor,
  ImageStorage,
  ProcessedImage,
} from '../images/image-storage.js'
import { logger } from '../logging/logger.js'
import type { ImageRepository } from '../repositories/contracts/image.repository.js'
import type { PublicationRepository } from '../repositories/contracts/publication.repository.js'

const maximumImages = 6
const mutableStatuses: readonly PublicationStatus[] = [
  'ACTIVE',
  'RESOLVED',
  'ADOPTED',
]

export class UploadPublicationImagesService {
  constructor(
    private readonly publications: PublicationRepository,
    private readonly images: ImageRepository,
    private readonly processor: ImageProcessor,
    private readonly storage: ImageStorage,
  ) {}

  async execute(publicationId: string, ownerId: string, inputs: Uint8Array[]) {
    if (inputs.length === 0) throw new ImageUploadEmptyError()
    const aggregate = await this.publications.findAggregateById(publicationId)
    if (!aggregate) throw new PublicationNotFoundError()
    if (aggregate.publication.userId !== ownerId)
      throw new ImageForbiddenError()
    if (!mutableStatuses.includes(aggregate.publication.status))
      throw new ImageUploadStatusNotAllowedError()
    if (aggregate.images.length + inputs.length > maximumImages)
      throw new ImageTooManyError()

    const storedKeys: string[] = []
    const metadata = []
    try {
      for (const input of inputs) {
        const processed = await this.processor.process(input)
        const keys = createImageStorageKeys(publicationId)
        await this.storage.write({
          key: keys.display,
          data: processed.display.data,
        })
        storedKeys.push(keys.display)
        await this.storage.write({
          key: keys.thumbnail,
          data: processed.thumbnail.data,
        })
        storedKeys.push(keys.thumbnail)
        metadata.push(toImageMetadata(keys.imageId, keys, processed))
      }
    } catch (error: unknown) {
      await compensateStorage(this.storage, storedKeys, publicationId)
      if (error instanceof AppError) throw error
      throw new StorageOperationError(error)
    }

    try {
      const result = await this.images.insertWithCapacity({
        publicationId,
        ownerId,
        allowedStatuses: mutableStatuses,
        maximumImages,
        images: metadata,
      })
      if (result.outcome === 'inserted') {
        logger.info(
          { publicationId, imageCount: result.images.length },
          'publication images uploaded',
        )
        return result.images.map(toPublicImageDto)
      }
      handleMutationFailure(result.outcome)
    } catch (error: unknown) {
      await compensateStorage(this.storage, storedKeys, publicationId)
      throw error
    }
  }
}

export class DeletePublicationImageService {
  constructor(
    private readonly images: ImageRepository,
    private readonly deletionJobs: ProcessStorageDeletionJobsService,
  ) {}

  async execute(publicationId: string, imageId: string, ownerId: string) {
    const result = await this.images.deleteWithOutbox({
      publicationId,
      imageId,
      ownerId,
    })
    if (result.outcome === 'not_found') throw new ImageNotFoundError()
    if (result.outcome === 'forbidden') throw new ImageForbiddenError()
    if (result.outcome === 'deleted')
      await this.deletionJobs.process(result.jobs)
  }
}

export class ReorderPublicationImagesService {
  constructor(private readonly images: ImageRepository) {}
  async execute(publicationId: string, ownerId: string, imageIds: string[]) {
    const result = await this.images.reorder({
      publicationId,
      ownerId,
      allowedStatuses: mutableStatuses,
      imageIds,
    })
    if (result.outcome === 'reordered')
      return result.images.map(toPublicImageDto)
    if (result.outcome === 'not_found') throw new PublicationNotFoundError()
    if (result.outcome === 'forbidden') throw new ImageForbiddenError()
    if (result.outcome === 'status_not_allowed')
      throw new ImageUploadStatusNotAllowedError()
    throw new ImageInvalidOrderError()
  }
}

export class GetPublicationImageContentService {
  constructor(
    private readonly images: ImageRepository,
    private readonly storage: ImageStorage,
  ) {}
  async execute(
    imageId: string,
    variant: 'display' | 'thumbnail',
    requesterId: string | undefined,
  ): Promise<{
    stream: Readable
    byteSize: number
    etag: string
  }> {
    const result = await this.images.findContentById(imageId)
    if (
      !result ||
      (result.publicationStatus === 'ARCHIVED' &&
        result.ownerId !== requesterId)
    )
      throw new ImageNotFoundError()
    const key =
      variant === 'display'
        ? result.image.storageKey
        : result.image.thumbnailStorageKey
    const byteSize =
      variant === 'display'
        ? result.image.displayByteSize
        : result.image.thumbnailByteSize
    const checksum =
      variant === 'display'
        ? result.image.displayChecksumSha256
        : result.image.thumbnailChecksumSha256
    if (!key || !byteSize || !checksum) throw new ImageNotFoundError()
    try {
      return {
        stream: await this.storage.read(key),
        byteSize,
        etag: `"${checksum}"`,
      }
    } catch (error: unknown) {
      throw new StorageOperationError(error)
    }
  }
}

export class ProcessStorageDeletionJobsService {
  constructor(
    private readonly images: ImageRepository,
    private readonly storage: ImageStorage,
  ) {}

  async execute(limit = 100): Promise<void> {
    await this.process(await this.images.findPendingDeletionJobs(limit))
  }

  async process(
    jobs: Awaited<ReturnType<ImageRepository['findPendingDeletionJobs']>>,
  ): Promise<void> {
    for (const job of jobs) {
      try {
        await this.storage.delete(job.storageKey)
        await this.images.markDeletionJobCompleted(job.id, new Date())
      } catch {
        await this.images.markDeletionJobFailed(
          job.id,
          new Date(Date.now() + 5 * 60_000),
          'storage deletion failed',
        )
        logger.warn({ deletionJobId: job.id }, 'storage deletion job pending')
      }
    }
  }
}

function toImageMetadata(
  id: string,
  keys: { display: string; thumbnail: string },
  image: ProcessedImage,
) {
  return {
    id,
    storageKey: keys.display,
    thumbnailStorageKey: keys.thumbnail,
    mimeType: 'image/webp' as const,
    displayWidth: image.display.width,
    displayHeight: image.display.height,
    displayByteSize: image.display.byteSize,
    displayChecksumSha256: image.display.checksumSha256,
    thumbnailWidth: image.thumbnail.width,
    thumbnailHeight: image.thumbnail.height,
    thumbnailByteSize: image.thumbnail.byteSize,
    thumbnailChecksumSha256: image.thumbnail.checksumSha256,
  }
}

async function compensateStorage(
  storage: ImageStorage,
  keys: readonly string[],
  publicationId: string,
): Promise<void> {
  const results = await Promise.allSettled(
    keys.map((key) => storage.delete(key)),
  )
  if (results.some((result) => result.status === 'rejected'))
    logger.error({ publicationId }, 'image storage compensation incomplete')
}

function handleMutationFailure(
  outcome: 'not_found' | 'forbidden' | 'status_not_allowed' | 'too_many',
): never {
  if (outcome === 'not_found') throw new PublicationNotFoundError()
  if (outcome === 'forbidden') throw new ImageForbiddenError()
  if (outcome === 'status_not_allowed')
    throw new ImageUploadStatusNotAllowedError()
  throw new ImageTooManyError()
}
