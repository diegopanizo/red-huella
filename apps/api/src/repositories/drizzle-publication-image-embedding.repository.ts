import { and, asc, eq, gt, ne, sql } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { publicationImageEmbeddings } from '../database/schema/publication-image-embeddings.js'
import { publicationImages } from '../database/schema/publication-images.js'
import { publications } from '../database/schema/publications.js'
import { serializeVisualEmbedding } from '../visual-search/embedding-vector.js'
import type {
  SimilarPublicationRecord,
  VisualSearchRepository,
} from '../visual-search/visual-search-api.js'
import type {
  EmbeddingIdentity,
  PublicationImageEmbeddingRepository,
} from './contracts/publication-image-embedding.repository.js'
import { visualEmbeddingErrorCodes } from './contracts/publication-image-embedding.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient

function identityCondition(identity: EmbeddingIdentity) {
  return and(
    eq(
      publicationImageEmbeddings.publicationImageId,
      identity.publicationImageId,
    ),
    eq(publicationImageEmbeddings.modelId, identity.modelId),
    eq(publicationImageEmbeddings.modelVersion, identity.modelVersion),
  )
}

export class DrizzlePublicationImageEmbeddingRepository
  implements PublicationImageEmbeddingRepository, VisualSearchRepository
{
  constructor(private readonly database: DatabaseClient) {}

  findImageSource(publicationImageId: string) {
    return runDatabaseOperation(async () => {
      const [record] = await this.database
        .select({
          publicationImageId: publicationImages.id,
          storageKey: publicationImages.storageKey,
        })
        .from(publicationImages)
        .where(eq(publicationImages.id, publicationImageId))
        .limit(1)
      return record
    })
  }

  findImagesNeedingEmbedding(
    input: Parameters<
      PublicationImageEmbeddingRepository['findImagesNeedingEmbedding']
    >[0],
  ) {
    return runDatabaseOperation(() =>
      this.database
        .select({
          publicationImageId: publicationImages.id,
          storageKey: publicationImages.storageKey,
          embeddingStatus: publicationImageEmbeddings.status,
          imageChecksum: publicationImageEmbeddings.imageChecksum,
        })
        .from(publicationImages)
        .innerJoin(
          publications,
          eq(publicationImages.publicationId, publications.id),
        )
        .leftJoin(
          publicationImageEmbeddings,
          and(
            eq(
              publicationImageEmbeddings.publicationImageId,
              publicationImages.id,
            ),
            eq(publicationImageEmbeddings.modelId, input.modelId),
            eq(publicationImageEmbeddings.modelVersion, input.modelVersion),
          ),
        )
        .where(
          and(
            ne(publications.status, 'ARCHIVED'),
            ...(input.afterImageId
              ? [gt(publicationImages.id, input.afterImageId)]
              : []),
            sql`((${input.includeMissing} and ${publicationImageEmbeddings.id} is null) or ${publicationImageEmbeddings.status} = 'PENDING' or (${input.includeFailed} and ${publicationImageEmbeddings.status} = 'FAILED'))`,
          ),
        )
        .orderBy(asc(publicationImages.id))
        .limit(input.limit),
    )
  }

  findByImageAndModel(identity: EmbeddingIdentity) {
    return runDatabaseOperation(async () => {
      const [record] = await this.database
        .select()
        .from(publicationImageEmbeddings)
        .where(identityCondition(identity))
        .limit(1)
      return record
    })
  }

  upsertPending(
    input: Parameters<PublicationImageEmbeddingRepository['upsertPending']>[0],
  ) {
    return runDatabaseOperation(() =>
      this.database.transaction(async (tx) => {
        await tx
          .insert(publicationImageEmbeddings)
          .values({
            publicationImageId: input.publicationImageId,
            modelId: input.modelId,
            modelVersion: input.modelVersion,
            imageChecksum: input.imageChecksum,
          })
          .onConflictDoUpdate({
            target: [
              publicationImageEmbeddings.publicationImageId,
              publicationImageEmbeddings.modelId,
              publicationImageEmbeddings.modelVersion,
            ],
            set: {
              imageChecksum: input.imageChecksum,
              status: 'PENDING',
              embedding: null,
              generatedAt: null,
              lastErrorCode: null,
              attemptCount: sql`case when ${publicationImageEmbeddings.imageChecksum} <> ${input.imageChecksum} then 0 else ${publicationImageEmbeddings.attemptCount} end`,
              updatedAt: sql`now()`,
            },
            setWhere: sql`${publicationImageEmbeddings.imageChecksum} <> ${input.imageChecksum} or (${input.retryFailed === true} and ${publicationImageEmbeddings.status} = 'FAILED')`,
          })

        const [record] = await tx
          .select()
          .from(publicationImageEmbeddings)
          .where(identityCondition(input))
          .limit(1)
        if (!record)
          throw new Error('No se pudo recuperar el embedding pendiente')
        return record
      }),
    )
  }

  markReady(
    input: Parameters<PublicationImageEmbeddingRepository['markReady']>[0],
  ) {
    const embedding = serializeVisualEmbedding(input.embedding)
    return runDatabaseOperation(async () => {
      const [record] = await this.database
        .update(publicationImageEmbeddings)
        .set({
          embedding,
          status: 'READY',
          generatedAt: sql`now()`,
          lastErrorCode: null,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            identityCondition(input),
            eq(publicationImageEmbeddings.imageChecksum, input.imageChecksum),
          ),
        )
        .returning()
      return record
    })
  }

  markFailed(
    input: Parameters<PublicationImageEmbeddingRepository['markFailed']>[0],
  ) {
    if (!visualEmbeddingErrorCodes.includes(input.errorCode))
      throw new Error('Código de error visual no permitido')

    return runDatabaseOperation(async () => {
      const [record] = await this.database
        .update(publicationImageEmbeddings)
        .set({
          embedding: null,
          status: 'FAILED',
          generatedAt: null,
          lastErrorCode: input.errorCode,
          attemptCount: sql`${publicationImageEmbeddings.attemptCount} + 1`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            identityCondition(input),
            eq(publicationImageEmbeddings.imageChecksum, input.imageChecksum),
          ),
        )
        .returning()
      return record
    })
  }

  deleteForImageAndModel(identity: EmbeddingIdentity) {
    return runDatabaseOperation(async () => {
      await this.database
        .delete(publicationImageEmbeddings)
        .where(identityCondition(identity))
    })
  }

  searchSimilarPublications(
    input: Parameters<VisualSearchRepository['searchSimilarPublications']>[0],
  ) {
    const vector = JSON.stringify(serializeVisualEmbedding(input.embedding))
    const typeCondition = input.targetType
      ? sql`p.type = ${input.targetType}`
      : sql`p.type in ('LOST', 'FOUND')`
    const speciesCondition = input.species
      ? sql`and a.species = ${input.species}`
      : sql``

    return runDatabaseOperation(async () => {
      const result = await this.database.execute<{
        publication_id: string
        type: SimilarPublicationRecord['type']
        title: string
        event_date: Date
        animal_name: string | null
        species: SimilarPublicationRecord['species']
        breed: string | null
        primary_image_id: string | null
        matched_image_id: string
        public_latitude: number | null
        public_longitude: number | null
        public_location_radius_meters: number | null
        visual_similarity: number
      }>(sql`
        with ranked as (
          select
            p.id as publication_id,
            p.type,
            p.title,
            p.event_date,
            a.name as animal_name,
            a.species,
            a.breed,
            pi.id as matched_image_id,
            first_value(pi.id) over (
              partition by p.id
              order by pi.position asc, pi.id asc
            ) as primary_image_id,
            case when p.public_location is null then null
              else ST_Y(p.public_location::geometry) end as public_latitude,
            case when p.public_location is null then null
              else ST_X(p.public_location::geometry) end as public_longitude,
            p.public_location_radius_meters,
            (pie.embedding <=> ${vector}::vector) as distance,
            row_number() over (
              partition by p.id
              order by pie.embedding <=> ${vector}::vector asc, pi.id asc
            ) as rank
          from publication_image_embeddings pie
          join publication_images pi on pi.id = pie.publication_image_id
          join publications p on p.id = pi.publication_id
          join animals a on a.id = p.animal_id
          join users u on u.id = p.user_id
          where pie.status = 'READY'
            and pie.model_id = ${input.modelId}
            and pie.model_version = ${input.modelVersion}
            and p.status = 'ACTIVE'
            and u.status = 'ACTIVE'
            and ${typeCondition}
            ${speciesCondition}
        )
        select
          publication_id, type, title, event_date, animal_name, species, breed,
          primary_image_id, matched_image_id, public_latitude, public_longitude,
          public_location_radius_meters,
          1 - distance as visual_similarity
        from ranked
        where rank = 1
        order by distance asc, publication_id asc
        limit ${input.limit}
      `)
      return result.rows.map((row) => ({
        publicationId: row.publication_id,
        type: row.type,
        title: row.title,
        eventDate: row.event_date,
        animalName: row.animal_name,
        species: row.species,
        breed: row.breed,
        primaryImageId: row.primary_image_id,
        matchedImageId: row.matched_image_id,
        publicLatitude:
          row.public_latitude === null ? null : Number(row.public_latitude),
        publicLongitude:
          row.public_longitude === null ? null : Number(row.public_longitude),
        publicLocationRadiusMeters: row.public_location_radius_meters,
        visualSimilarity: Number(row.visual_similarity),
      }))
    })
  }
}
