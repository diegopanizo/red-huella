import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import {
  publicationImages,
  storageDeletionJobs,
} from '../database/schema/publication-images.js'
import { publicationImageEmbeddings } from '../database/schema/publication-image-embeddings.js'
import { publications } from '../database/schema/publications.js'
import type {
  ImageRepository,
  InsertImagesResult,
  DeleteImageResult,
  ReorderImagesResult,
} from './contracts/image.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient

export class DrizzleImageRepository implements ImageRepository {
  constructor(private readonly database: DatabaseClient) {}

  listByPublication(publicationId: string) {
    return runDatabaseOperation(() =>
      this.database
        .select()
        .from(publicationImages)
        .where(eq(publicationImages.publicationId, publicationId))
        .orderBy(asc(publicationImages.position)),
    )
  }

  insertWithCapacity(
    input: Parameters<ImageRepository['insertWithCapacity']>[0],
  ): Promise<InsertImagesResult> {
    return runDatabaseOperation(() =>
      this.database.transaction(async (tx) => {
        const [publication] = await tx
          .select({
            ownerId: publications.userId,
            status: publications.status,
          })
          .from(publications)
          .where(eq(publications.id, input.publicationId))
          .for('update')
          .limit(1)
        if (!publication) return { outcome: 'not_found' as const }
        if (publication.ownerId !== input.ownerId)
          return { outcome: 'forbidden' as const }
        if (!input.allowedStatuses.includes(publication.status))
          return { outcome: 'status_not_allowed' as const }

        const existing = await tx
          .select({ position: publicationImages.position })
          .from(publicationImages)
          .where(eq(publicationImages.publicationId, input.publicationId))
          .orderBy(asc(publicationImages.position))
        if (existing.length + input.images.length > input.maximumImages)
          return { outcome: 'too_many' as const }

        const imageValues = input.images.map((image, index) => {
          const { pendingEmbedding, ...metadata } = image
          void pendingEmbedding
          return {
            ...metadata,
            publicationId: input.publicationId,
            position: existing.length + index,
          }
        })
        const inserted = await tx
          .insert(publicationImages)
          .values(imageValues)
          .returning()
        await tx.insert(publicationImageEmbeddings).values(
          input.images.map((image) => ({
            publicationImageId: image.id,
            modelId: image.pendingEmbedding.modelId,
            modelVersion: image.pendingEmbedding.modelVersion,
            imageChecksum: image.pendingEmbedding.imageChecksum,
          })),
        )
        return { outcome: 'inserted' as const, images: inserted }
      }),
    )
  }

  deleteWithOutbox(
    input: Parameters<ImageRepository['deleteWithOutbox']>[0],
  ): Promise<DeleteImageResult> {
    return runDatabaseOperation(() =>
      this.database.transaction(async (tx) => {
        const [publication] = await tx
          .select({ ownerId: publications.userId })
          .from(publications)
          .where(eq(publications.id, input.publicationId))
          .for('update')
          .limit(1)
        if (!publication) return { outcome: 'not_found' as const }
        if (publication.ownerId !== input.ownerId)
          return { outcome: 'forbidden' as const }

        const [image] = await tx
          .select()
          .from(publicationImages)
          .where(
            and(
              eq(publicationImages.id, input.imageId),
              eq(publicationImages.publicationId, input.publicationId),
            ),
          )
          .limit(1)
        if (!image) return { outcome: 'not_found' as const }

        await tx
          .delete(publicationImages)
          .where(eq(publicationImages.id, image.id))
        await tx
          .update(publicationImages)
          .set({ position: sql`${publicationImages.position} + 1000` })
          .where(
            and(
              eq(publicationImages.publicationId, input.publicationId),
              gt(publicationImages.position, image.position),
            ),
          )
        await tx
          .update(publicationImages)
          .set({ position: sql`${publicationImages.position} - 1001` })
          .where(
            and(
              eq(publicationImages.publicationId, input.publicationId),
              gt(publicationImages.position, 1000),
            ),
          )

        const keys = [image.storageKey, image.thumbnailStorageKey].filter(
          (key): key is string => key !== null,
        )
        const jobs = await tx
          .insert(storageDeletionJobs)
          .values(keys.map((storageKey) => ({ storageKey })))
          .returning()
        return { outcome: 'deleted' as const, jobs }
      }),
    )
  }

  reorder(
    input: Parameters<ImageRepository['reorder']>[0],
  ): Promise<ReorderImagesResult> {
    return runDatabaseOperation(() =>
      this.database.transaction(async (tx) => {
        const [publication] = await tx
          .select({
            ownerId: publications.userId,
            status: publications.status,
          })
          .from(publications)
          .where(eq(publications.id, input.publicationId))
          .for('update')
          .limit(1)
        if (!publication) return { outcome: 'not_found' as const }
        if (publication.ownerId !== input.ownerId)
          return { outcome: 'forbidden' as const }
        if (!input.allowedStatuses.includes(publication.status))
          return { outcome: 'status_not_allowed' as const }

        const current = await tx
          .select()
          .from(publicationImages)
          .where(eq(publicationImages.publicationId, input.publicationId))
          .orderBy(asc(publicationImages.position))
        const currentIds = new Set(current.map((image) => image.id))
        if (
          input.imageIds.length !== current.length ||
          new Set(input.imageIds).size !== input.imageIds.length ||
          input.imageIds.some((id) => !currentIds.has(id))
        )
          return { outcome: 'invalid_order' as const }

        await tx
          .update(publicationImages)
          .set({ position: sql`${publicationImages.position} + 1000` })
          .where(eq(publicationImages.publicationId, input.publicationId))
        for (const [position, id] of input.imageIds.entries()) {
          await tx
            .update(publicationImages)
            .set({ position })
            .where(eq(publicationImages.id, id))
        }
        const images = await tx
          .select()
          .from(publicationImages)
          .where(eq(publicationImages.publicationId, input.publicationId))
          .orderBy(asc(publicationImages.position))
        return { outcome: 'reordered' as const, images }
      }),
    )
  }

  findContentById(imageId: string) {
    return runDatabaseOperation(async () => {
      const [result] = await this.database
        .select({
          image: publicationImages,
          publicationStatus: publications.status,
          ownerId: publications.userId,
        })
        .from(publicationImages)
        .innerJoin(
          publications,
          eq(publicationImages.publicationId, publications.id),
        )
        .where(eq(publicationImages.id, imageId))
        .limit(1)
      return result
    })
  }

  findPendingDeletionJobs(limit: number) {
    return runDatabaseOperation(() =>
      this.database
        .select()
        .from(storageDeletionJobs)
        .where(
          and(
            isNull(storageDeletionJobs.completedAt),
            sql`${storageDeletionJobs.nextAttemptAt} <= now()`,
          ),
        )
        .orderBy(asc(storageDeletionJobs.nextAttemptAt))
        .limit(limit),
    )
  }

  markDeletionJobCompleted(id: string, completedAt: Date) {
    return runDatabaseOperation(async () => {
      await this.database
        .update(storageDeletionJobs)
        .set({ completedAt, lastError: null })
        .where(eq(storageDeletionJobs.id, id))
    })
  }

  markDeletionJobFailed(id: string, nextAttemptAt: Date, message: string) {
    return runDatabaseOperation(async () => {
      await this.database
        .update(storageDeletionJobs)
        .set({
          attempts: sql`${storageDeletionJobs.attempts} + 1`,
          nextAttemptAt,
          lastError: message,
        })
        .where(eq(storageDeletionJobs.id, id))
    })
  }
}
