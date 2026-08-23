import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { env } from '../config/index.js'
import * as schema from '../database/schema/index.js'
import { assertSafeTestDatabaseUrl } from '../database/test-database.js'
import { DrizzlePublicationImageEmbeddingRepository } from '../repositories/drizzle-publication-image-embedding.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { PostgresVisualEmbeddingClaim } from './embedding-claim.js'
import { VISUAL_MODEL_ID, VISUAL_MODEL_VERSION } from './visual-embedding.js'

const pool = new Pool({
  connectionString: assertSafeTestDatabaseUrl(env),
  max: 4,
})
const database = drizzle({ client: pool, schema })
const embeddings = new DrizzlePublicationImageEmbeddingRepository(database)
const publications = new DrizzlePublicationRepository(database)
const users = new DrizzleUserRepository(database)
const identityBase = {
  modelId: VISUAL_MODEL_ID,
  modelVersion: VISUAL_MODEL_VERSION,
}
const checksumA = 'a'.repeat(64)
const checksumB = 'b'.repeat(64)

beforeAll(async () => {
  await migrate(database, {
    migrationsFolder: fileURLToPath(
      new URL('../database/migrations', import.meta.url),
    ),
  })
})

beforeEach(async () => {
  await database.delete(schema.publicationImageEmbeddings)
  await database.delete(schema.storageDeletionJobs)
  await database.delete(schema.sessions)
  await database.delete(schema.publicationImages)
  await database.delete(schema.publications)
  await database.delete(schema.animals)
  await database.delete(schema.users)
})

afterAll(async () => {
  await pool.end()
})

describe('pgvector publication image embeddings', () => {
  it('allows only one concurrent advisory claim for the same image', async () => {
    const claim = new PostgresVisualEmbeddingClaim(pool)
    const imageId = await createImage()
    let release: (() => void) | undefined
    let signalStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = claim.runClaimed(imageId, async () => {
      signalStarted?.()
      await gate
      return 'first'
    })
    await started
    await expect(
      claim.runClaimed(imageId, async () => 'second'),
    ).resolves.toEqual({ claimed: false })
    release?.()
    await expect(first).resolves.toEqual({ claimed: true, result: 'first' })
  })

  it('selects missing and PENDING rows, optionally FAILED, and omits READY/ARCHIVED', async () => {
    const missing = await createImage()
    const pending = await createImage()
    const failed = await createImage()
    const ready = await createImage()
    const archived = await createImage()
    for (const [id, status] of [
      [pending, 'PENDING'],
      [failed, 'FAILED'],
      [ready, 'READY'],
      [archived, 'PENDING'],
    ] as const) {
      await embeddings.upsertPending({
        publicationImageId: id,
        ...identityBase,
        imageChecksum: checksumA,
      })
      if (status === 'FAILED')
        await embeddings.markFailed({
          publicationImageId: id,
          ...identityBase,
          imageChecksum: checksumA,
          errorCode: 'INVALID_IMAGE',
        })
      if (status === 'READY')
        await embeddings.markReady({
          publicationImageId: id,
          ...identityBase,
          imageChecksum: checksumA,
          embedding: unitVector(),
        })
    }
    const [archivedImage] = await database
      .select({ publicationId: schema.publicationImages.publicationId })
      .from(schema.publicationImages)
      .where(eq(schema.publicationImages.id, archived))
    if (!archivedImage) throw new Error('Expected archived fixture')
    await publications.updateStatus(
      archivedImage.publicationId,
      'ARCHIVED',
      null,
      new Date(),
    )

    const normal = await embeddings.findImagesNeedingEmbedding({
      ...identityBase,
      limit: 25,
      includeMissing: true,
      includeFailed: false,
    })
    expect(normal.map((item) => item.publicationImageId).sort()).toEqual(
      [missing, pending].sort(),
    )
    const automatic = await embeddings.findImagesNeedingEmbedding({
      ...identityBase,
      limit: 25,
      includeMissing: false,
      includeFailed: false,
    })
    expect(automatic.map((item) => item.publicationImageId)).toEqual([pending])
    const withFailed = await embeddings.findImagesNeedingEmbedding({
      ...identityBase,
      limit: 25,
      includeMissing: true,
      includeFailed: true,
    })
    expect(withFailed.map((item) => item.publicationImageId).sort()).toEqual(
      [missing, pending, failed].sort(),
    )
  })

  it('installs vector 0.8.5 through migration 0005', async () => {
    const result = await pool.query<{ installed_version: string }>(
      `select installed_version
       from pg_available_extensions
       where name = 'vector'`,
    )
    expect(result.rows[0]?.installed_version).toBe('0.8.5')
  })

  it('stores a valid PENDING row without embedding or generation timestamp', async () => {
    const imageId = await createImage()
    const record = await embeddings.upsertPending({
      publicationImageId: imageId,
      ...identityBase,
      imageChecksum: checksumA,
    })
    expect(record).toMatchObject({
      publicationImageId: imageId,
      imageChecksum: checksumA,
      status: 'PENDING',
      embedding: null,
      generatedAt: null,
      attemptCount: 0,
    })
  })

  it.each([
    {
      label: 'READY without embedding',
      status: 'READY',
      embedding: null,
      generatedAt: new Date(),
      lastErrorCode: null,
    },
    {
      label: 'READY without generated_at',
      status: 'READY',
      embedding: unitVector(),
      generatedAt: null,
      lastErrorCode: null,
    },
    {
      label: 'FAILED with embedding',
      status: 'FAILED',
      embedding: unitVector(),
      generatedAt: null,
      lastErrorCode: 'INVALID_IMAGE',
    },
    {
      label: 'PENDING with embedding',
      status: 'PENDING',
      embedding: unitVector(),
      generatedAt: null,
      lastErrorCode: null,
    },
  ])('rejects inconsistent lifecycle: $label', async (state) => {
    const imageId = await createImage()
    await expect(
      database.insert(schema.publicationImageEmbeddings).values({
        publicationImageId: imageId,
        ...identityBase,
        imageChecksum: checksumA,
        status: state.status as 'PENDING' | 'READY' | 'FAILED',
        embedding: state.embedding,
        generatedAt: state.generatedAt,
        lastErrorCode: state.lastErrorCode,
      }),
    ).rejects.toBeDefined()
  })

  it('accepts READY and rejects wrong vector dimensions', async () => {
    const imageId = await createImage()
    await expect(
      database.insert(schema.publicationImageEmbeddings).values({
        publicationImageId: imageId,
        ...identityBase,
        imageChecksum: checksumA,
        status: 'READY',
        embedding: unitVector(),
        generatedAt: new Date(),
      }),
    ).resolves.toBeDefined()

    const otherImageId = await createImage(1)
    await expect(
      pool.query(
        `insert into publication_image_embeddings
         (publication_image_id, model_id, model_version, image_checksum, status, embedding, generated_at)
         values ($1, $2, $3, $4, 'READY', $5::vector, now())`,
        [
          otherImageId,
          VISUAL_MODEL_ID,
          VISUAL_MODEL_VERSION,
          checksumA,
          `[${Array.from({ length: 511 }, () => 0).join(',')}]`,
        ],
      ),
    ).rejects.toThrow(/expected 512 dimensions/i)
  })

  it('enforces checksum, attempt count, unique identity, and image FK', async () => {
    const imageId = await createImage()
    const values = {
      publicationImageId: imageId,
      ...identityBase,
      imageChecksum: checksumA,
    }
    await database.insert(schema.publicationImageEmbeddings).values(values)
    await expect(
      database.insert(schema.publicationImageEmbeddings).values(values),
    ).rejects.toBeDefined()
    await expect(
      database.insert(schema.publicationImageEmbeddings).values({
        ...values,
        modelVersion: 'other',
        imageChecksum: 'INVALID',
      }),
    ).rejects.toBeDefined()
    await expect(
      database.insert(schema.publicationImageEmbeddings).values({
        ...values,
        modelVersion: 'other',
        attemptCount: -1,
      }),
    ).rejects.toBeDefined()
    await expect(
      database.insert(schema.publicationImageEmbeddings).values({
        ...values,
        publicationImageId: randomUUID(),
        modelVersion: 'other',
      }),
    ).rejects.toBeDefined()
  })

  it('deletes embeddings through publication image FK cascade', async () => {
    const imageId = await createImage()
    await embeddings.upsertPending({
      publicationImageId: imageId,
      ...identityBase,
      imageChecksum: checksumA,
    })
    await database
      .delete(schema.publicationImages)
      .where(eq(schema.publicationImages.id, imageId))
    await expect(
      embeddings.findByImageAndModel({
        publicationImageId: imageId,
        ...identityBase,
      }),
    ).resolves.toBeUndefined()
  })

  it('keeps READY idempotently, retries FAILED explicitly, and resets changed content', async () => {
    const imageId = await createImage()
    const identity = { publicationImageId: imageId, ...identityBase }
    await embeddings.upsertPending({ ...identity, imageChecksum: checksumA })
    await embeddings.markReady({
      ...identity,
      imageChecksum: checksumA,
      embedding: unitVector(),
    })

    const ready = await embeddings.upsertPending({
      ...identity,
      imageChecksum: checksumA,
    })
    expect(ready.status).toBe('READY')
    expect(ready.embedding).toEqual(unitVector())

    await embeddings.markFailed({
      ...identity,
      imageChecksum: checksumA,
      errorCode: 'EMBEDDING_GENERATION_FAILED',
    })
    const failed = await embeddings.upsertPending({
      ...identity,
      imageChecksum: checksumA,
    })
    expect(failed.status).toBe('FAILED')
    const retried = await embeddings.upsertPending({
      ...identity,
      imageChecksum: checksumA,
      retryFailed: true,
    })
    expect(retried.status).toBe('PENDING')
    expect(retried.attemptCount).toBe(1)

    const changed = await embeddings.upsertPending({
      ...identity,
      imageChecksum: checksumB,
    })
    expect(changed).toMatchObject({
      status: 'PENDING',
      imageChecksum: checksumB,
      embedding: null,
      generatedAt: null,
      attemptCount: 0,
    })
  })

  it('marks READY only for the expected checksum and validates normalized values', async () => {
    const imageId = await createImage()
    const identity = { publicationImageId: imageId, ...identityBase }
    await embeddings.upsertPending({ ...identity, imageChecksum: checksumA })
    expect(() =>
      embeddings.markReady({
        ...identity,
        imageChecksum: checksumA,
        embedding: Array.from({ length: 512 }, (_, index) =>
          index === 0 ? 2 : 0,
        ),
      }),
    ).toThrow(/normalizado/i)
    await expect(
      embeddings.markReady({
        ...identity,
        imageChecksum: checksumB,
        embedding: unitVector(),
      }),
    ).resolves.toBeUndefined()
    const ready = await embeddings.markReady({
      ...identity,
      imageChecksum: checksumA,
      embedding: new Float32Array(unitVector()),
    })
    expect(ready).toMatchObject({
      status: 'READY',
      lastErrorCode: null,
      imageChecksum: checksumA,
    })
    expect(ready?.generatedAt).toBeInstanceOf(Date)
  })

  it('marks failures with an allowlisted code and increments attempts', async () => {
    const imageId = await createImage()
    const identity = { publicationImageId: imageId, ...identityBase }
    await embeddings.upsertPending({ ...identity, imageChecksum: checksumA })
    const failed = await embeddings.markFailed({
      ...identity,
      imageChecksum: checksumA,
      errorCode: 'INVALID_MODEL_OUTPUT',
    })
    expect(failed).toMatchObject({
      status: 'FAILED',
      embedding: null,
      generatedAt: null,
      lastErrorCode: 'INVALID_MODEL_OUTPUT',
      attemptCount: 1,
    })
    expect(() =>
      embeddings.markFailed({
        ...identity,
        imageChecksum: checksumA,
        errorCode: 'arbitrary-detail' as 'INVALID_IMAGE',
      }),
    ).toThrow(/no permitido/i)
  })

  it('orders synthetic vectors by exact cosine distance with <=>', async () => {
    const ids = await Promise.all([
      createImage(0),
      createImage(1),
      createImage(2),
    ])
    const vectors = [
      unitVector(),
      normalizedVector(0.98, 0.2),
      normalizedVector(0, 1),
    ]
    for (const [index, imageId] of ids.entries()) {
      await embeddings.upsertPending({
        publicationImageId: imageId,
        ...identityBase,
        imageChecksum: String(index).repeat(64),
      })
      await embeddings.markReady({
        publicationImageId: imageId,
        ...identityBase,
        imageChecksum: String(index).repeat(64),
        embedding: vectors[index]!,
      })
    }

    const query = JSON.stringify(unitVector())
    const result = await database.execute<{ publication_image_id: string }>(
      sql`select publication_image_id
          from publication_image_embeddings
          where status = 'READY'
          order by embedding <=> ${query}::vector`,
    )
    expect(result.rows.map((row) => row.publication_image_id)).toEqual(ids)
  })

  it('searches public READY candidates and keeps the best image per publication', async () => {
    const imageA = await createImage()
    const imageB = await createImage()
    const imageD1 = await createImage()
    const publicationD = await imagePublication(imageD1)
    const [imageD2] = await database
      .insert(schema.publicationImages)
      .values({
        publicationId: publicationD.publicationId,
        storageKey: `tests/${randomUUID()}/display.webp`,
        position: 1,
      })
      .returning({ id: schema.publicationImages.id })
    if (!imageD2) throw new Error('Expected second image D')

    await makeReady(imageA, unitVector())
    await makeReady(imageB, normalizedVector(0.8, 0.6))
    await makeReady(imageD1, normalizedVector(0, 1))
    await makeReady(imageD2.id, normalizedVector(0.99, 0.1))

    const result = await embeddings.searchSimilarPublications({
      embedding: Float32Array.from(unitVector()),
      ...identityBase,
      targetType: 'LOST',
      species: 'DOG',
      limit: 2,
    })
    expect(result).toHaveLength(2)
    expect(result[0]?.publicationId).toBe(
      (await imagePublication(imageA)).publicationId,
    )
    const matchD = result.find(
      (item) => item.publicationId === publicationD.publicationId,
    )
    expect(matchD?.matchedImageId).toBe(imageD2.id)
    expect(matchD?.primaryImageId).toBe(imageD1)
    expect(
      result.filter(
        (item) => item.publicationId === publicationD.publicationId,
      ),
    ).toHaveLength(1)
  })

  it('excludes non-public, non-READY and wrong-version embeddings', async () => {
    const ready = await createImage()
    const pending = await createImage()
    const archived = await createImage()
    const blocked = await createImage()
    const wrongVersion = await createImage()
    await makeReady(ready, unitVector())
    await embeddings.upsertPending({
      publicationImageId: pending,
      ...identityBase,
      imageChecksum: checksumA,
    })
    await makeReady(archived, unitVector())
    await makeReady(blocked, unitVector())
    await embeddings.upsertPending({
      publicationImageId: wrongVersion,
      modelId: VISUAL_MODEL_ID,
      modelVersion: 'other-version',
      imageChecksum: checksumA,
    })
    await embeddings.markReady({
      publicationImageId: wrongVersion,
      modelId: VISUAL_MODEL_ID,
      modelVersion: 'other-version',
      imageChecksum: checksumA,
      embedding: unitVector(),
    })
    const archivedPublication = await imagePublication(archived)
    await publications.updateStatus(
      archivedPublication.publicationId,
      'ARCHIVED',
      null,
      new Date(),
    )
    const blockedPublication = await imagePublication(blocked)
    await database
      .update(schema.users)
      .set({ status: 'BLOCKED' })
      .where(eq(schema.users.id, blockedPublication.userId))

    const result = await embeddings.searchSimilarPublications({
      embedding: Float32Array.from(unitVector()),
      ...identityBase,
      limit: 50,
    })
    expect(result.map((item) => item.publicationId)).toEqual([
      (await imagePublication(ready)).publicationId,
    ])
    expect(JSON.stringify(result)).not.toContain('exactLocation')
  })

  it('does not join or expose embeddings in publication aggregates', async () => {
    const imageId = await createImage()
    await embeddings.upsertPending({
      publicationImageId: imageId,
      ...identityBase,
      imageChecksum: checksumA,
    })
    const [image] = await database
      .select({ publicationId: schema.publicationImages.publicationId })
      .from(schema.publicationImages)
      .where(eq(schema.publicationImages.id, imageId))
    if (!image) throw new Error('Expected image fixture')
    const aggregate = await publications.findAggregateById(image.publicationId)
    expect(aggregate).not.toHaveProperty('embedding')
    expect(aggregate?.images.every((record) => !('embedding' in record))).toBe(
      true,
    )
    expect(JSON.stringify(aggregate)).not.toContain(VISUAL_MODEL_ID)
  })
})

async function createImage(position = 0): Promise<string> {
  const user = await users.create({
    name: 'Visual embedding owner',
    email: `${randomUUID()}@example.test`,
  })
  const aggregate = await publications.createWithAnimal(
    {
      userId: user.id,
      type: 'LOST',
      title: 'Visual embedding fixture',
      eventDate: new Date('2026-01-01T00:00:00Z'),
    },
    { species: 'DOG' },
  )
  const [image] = await database
    .insert(schema.publicationImages)
    .values({
      publicationId: aggregate.publication.id,
      storageKey: `tests/${randomUUID()}/display.webp`,
      position,
    })
    .returning({ id: schema.publicationImages.id })
  if (!image) throw new Error('Expected image fixture')
  return image.id
}

function unitVector(): number[] {
  return Array.from({ length: 512 }, (_, index) => (index === 0 ? 1 : 0))
}

async function makeReady(imageId: string, vector: number[]) {
  await embeddings.upsertPending({
    publicationImageId: imageId,
    ...identityBase,
    imageChecksum: checksumA,
  })
  await embeddings.markReady({
    publicationImageId: imageId,
    ...identityBase,
    imageChecksum: checksumA,
    embedding: vector,
  })
}

async function imagePublication(imageId: string) {
  const [result] = await database
    .select({
      publicationId: schema.publicationImages.publicationId,
      userId: schema.publications.userId,
    })
    .from(schema.publicationImages)
    .innerJoin(
      schema.publications,
      eq(schema.publications.id, schema.publicationImages.publicationId),
    )
    .where(eq(schema.publicationImages.id, imageId))
  if (!result) throw new Error('Expected image publication')
  return result
}

function normalizedVector(first: number, second: number): number[] {
  const norm = Math.hypot(first, second)
  return Array.from({ length: 512 }, (_, index) =>
    index === 0 ? first / norm : index === 1 ? second / norm : 0,
  )
}
