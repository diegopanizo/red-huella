import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Router } from 'express'
import { Pool } from 'pg'
import sharp from 'sharp'
import request from 'supertest'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { createApp } from '../app.js'
import { createSessionToken } from '../auth/session-token.js'
import { env } from '../config/index.js'
import * as schema from '../database/schema/index.js'
import { assertSafeTestDatabaseUrl } from '../database/test-database.js'
import { LocalImageStorage } from './local-image-storage.js'
import type { ImageStorage, WriteImageObjectInput } from './image-storage.js'
import { SharpImageProcessor } from './sharp-image-processor.js'
import { DrizzleImageRepository } from '../repositories/drizzle-image.repository.js'
import type { ImageRepository } from '../repositories/contracts/image.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { createPublicationImageContentRouter } from '../routes/publication-image.routes.js'
import { createPublicationRouter } from '../routes/publication.routes.js'
import { VisualEmbeddingGenerator } from '../visual-search/visual-embedding.js'

const pool = new Pool({
  connectionString: assertSafeTestDatabaseUrl(env),
  max: 10,
})
const database = drizzle({ client: pool, schema })
const users = new DrizzleUserRepository(database)
const sessions = new DrizzleSessionRepository(database)
const publications = new DrizzlePublicationRepository(database)
const images = new DrizzleImageRepository(database)
let storageRoot: string
let storage: LocalImageStorage
let app: ReturnType<typeof createApp>
let validJpeg: Buffer
let validPng: Buffer
let validWebp: Buffer

beforeAll(async () => {
  await migrate(database, {
    migrationsFolder: fileURLToPath(
      new URL('../database/migrations', import.meta.url),
    ),
  })
  storageRoot = await mkdtemp(path.join(tmpdir(), 'red-huella-http-images-'))
  storage = new LocalImageStorage(storageRoot)
  app = createTestApp(storage, images)
  validJpeg = await fixture().jpeg().toBuffer()
  validPng = await fixture().png().toBuffer()
  validWebp = await fixture().webp().toBuffer()
})

beforeEach(async () => {
  await database.delete(schema.storageDeletionJobs)
  await database.delete(schema.sessions)
  await database.delete(schema.publicationImages)
  await database.delete(schema.publications)
  await database.delete(schema.animals)
  await database.delete(schema.users)
  await rm(storageRoot, { recursive: true, force: true })
  await mkdir(storageRoot, { recursive: true })
})

afterAll(async () => {
  await pool.end()
  await rm(storageRoot, { recursive: true, force: true })
})

describe('publication image HTTP and PostgreSQL integration', () => {
  it('uploads JPEG/PNG/WebP, hides keys and serves independent variants with 304', async () => {
    const inference = vi
      .spyOn(
        VisualEmbeddingGenerator.prototype,
        'generateImageEmbeddingWithMetrics',
      )
      .mockImplementation(() => new Promise(() => undefined))
    const owner = await createOwnerPublication()
    const upload = await uploadFiles(owner, [validJpeg, validPng, validWebp])
    expect(inference).not.toHaveBeenCalled()
    inference.mockRestore()
    expect(upload.status).toBe(201)
    expect(upload.body.images).toHaveLength(3)
    expect(JSON.stringify(upload.body)).not.toContain('storageKey')
    expect(JSON.stringify(upload.body)).not.toContain(storageRoot)

    const image = upload.body.images[0] as {
      id: string
      url: string
      thumbnailUrl: string
    }
    const display = await request(app).get(image.url)
    const thumbnail = await request(app).get(image.thumbnailUrl)
    expect(display.status).toBe(200)
    expect(display.headers['content-type']).toMatch(/^image\/webp/)
    expect(display.headers['x-content-type-options']).toBe('nosniff')
    expect(display.headers['cross-origin-resource-policy']).toBe('cross-origin')
    expect(thumbnail.headers['cross-origin-resource-policy']).toBe(
      'cross-origin',
    )
    expect(display.headers['cache-control']).toContain('no-cache')
    expect(display.headers.etag).not.toBe(thumbnail.headers.etag)
    expect(
      (
        await request(app)
          .get(image.url)
          .set('If-None-Match', display.headers.etag as string)
      ).status,
    ).toBe(304)

    const aggregate = await publications.findAggregateById(owner.publicationId)
    expect(aggregate?.images).toHaveLength(3)
    expect(
      aggregate?.images.every((item) => item.mimeType === 'image/webp'),
    ).toBe(true)
    const pendingEmbeddings = await database
      .select()
      .from(schema.publicationImageEmbeddings)
    expect(pendingEmbeddings).toHaveLength(3)
    expect(pendingEmbeddings.every((item) => item.status === 'PENDING')).toBe(
      true,
    )
    for (const publicationResponse of [
      await request(app).get(`/api/v1/publications/${owner.publicationId}`),
      await request(app).get('/api/v1/publications'),
      await request(app)
        .get('/api/v1/publications/mine')
        .set('Cookie', owner.cookie),
    ]) {
      expect(publicationResponse.status).toBe(200)
      expect(JSON.stringify(publicationResponse.body)).not.toContain(
        'storageKey',
      )
      expect(JSON.stringify(publicationResponse.body)).not.toContain(
        storageRoot,
      )
    }
  })

  it('enforces authentication, Origin, ownership and status policy', async () => {
    const owner = await createOwnerPublication()
    expect(
      (
        await request(app).post(
          `/api/v1/publications/${owner.publicationId}/images`,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .post(`/api/v1/publications/${owner.publicationId}/images`)
          .set('Origin', env.WEB_ORIGIN)
          .attach('images', validJpeg, 'pet.jpg')
      ).status,
    ).toBe(401)

    const other = await createAuthenticatedUser()
    expect(
      (await uploadFiles({ ...owner, cookie: other.cookie }, [validJpeg]))
        .status,
    ).toBe(403)

    await publications.updateStatus(
      owner.publicationId,
      'RESOLVED',
      new Date(),
      new Date(),
    )
    expect((await uploadFiles(owner, [validJpeg])).status).toBe(201)
    await publications.updateStatus(
      owner.publicationId,
      'ARCHIVED',
      null,
      new Date(),
    )
    expect((await uploadFiles(owner, [validJpeg])).status).toBe(400)

    const adopted = await createOwnerPublication()
    await publications.updateStatus(
      adopted.publicationId,
      'ADOPTED',
      new Date(),
      new Date(),
    )
    expect((await uploadFiles(adopted, [validJpeg])).status).toBe(201)
  })

  it('rejects empty, unexpected, corrupt and multipart size violations', async () => {
    const owner = await createOwnerPublication()
    const endpoint = `/api/v1/publications/${owner.publicationId}/images`
    const base = () =>
      request(app)
        .post(endpoint)
        .set('Origin', env.WEB_ORIGIN)
        .set('Cookie', owner.cookie)

    expect((await base()).body.error.code).toBe('IMAGE_UPLOAD_EMPTY')
    expect((await base().attach('other', validJpeg, 'x.jpg')).status).toBe(400)
    expect(
      (await base().attach('images', Buffer.from('bad'), 'x.jpg')).body.error
        .code,
    ).toBe('IMAGE_CORRUPT')
    expect(
      (
        await base().attach(
          'images',
          Buffer.alloc(8 * 1024 * 1024 + 1),
          'x.jpg',
        )
      ).body.error.code,
    ).toBe('IMAGE_FILE_TOO_LARGE')

    const total = base()
    for (let index = 0; index < 4; index += 1)
      total.attach(
        'images',
        Buffer.alloc(6 * 1024 * 1024 + 1),
        `x-${index}.jpg`,
      )
    expect((await total).body.error.code).toBe('IMAGE_REQUEST_TOO_LARGE')

    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    )
    const gif = await fixture().gif().toBuffer()
    const heif = await fixture().heif({ compression: 'av1' }).toBuffer()
    for (const invalid of [svg, gif, heif])
      expect(
        (await base().attach('images', invalid, 'client.jpg')).body.error.code,
      ).toBe('IMAGE_FORMAT_NOT_ALLOWED')
  })

  it('never exceeds six images under concurrent uploads', async () => {
    const owner = await createOwnerPublication()
    expect(
      (await uploadFiles(owner, [validJpeg, validJpeg, validJpeg, validJpeg]))
        .status,
    ).toBe(201)
    const [first, second] = await Promise.all([
      uploadFiles(owner, [validPng, validWebp]),
      uploadFiles(owner, [validPng, validWebp]),
    ])
    expect([first.status, second.status].sort()).toEqual([201, 400])
    expect(await images.listByPublication(owner.publicationId)).toHaveLength(6)
    expect((await uploadFiles(owner, [validJpeg])).body.error.code).toBe(
      'IMAGE_TOO_MANY',
    )
  })

  it('reorders densely and rejects missing, duplicate and foreign IDs', async () => {
    const owner = await createOwnerPublication()
    const uploaded = await uploadFiles(owner, [validJpeg, validPng, validWebp])
    const ids = (uploaded.body.images as Array<{ id: string }>).map(
      (item) => item.id,
    )
    const endpoint = `/api/v1/publications/${owner.publicationId}/images/order`
    const reorder = (imageIds: string[]) =>
      request(app)
        .patch(endpoint)
        .set('Origin', env.WEB_ORIGIN)
        .set('Cookie', owner.cookie)
        .send({ imageIds })

    const valid = await reorder([...ids].reverse())
    expect(valid.status).toBe(200)
    expect(valid.body.images.map((item: { id: string }) => item.id)).toEqual(
      [...ids].reverse(),
    )
    expect((await reorder(ids.slice(0, 2))).body.error.code).toBe(
      'IMAGE_INVALID_ORDER',
    )
    expect((await reorder([ids[0]!, ids[0]!, ids[2]!])).body.error.code).toBe(
      'IMAGE_INVALID_ORDER',
    )
    expect(
      (await reorder([ids[0]!, ids[1]!, randomUUID()])).body.error.code,
    ).toBe('IMAGE_INVALID_ORDER')

    await publications.updateStatus(
      owner.publicationId,
      'ARCHIVED',
      null,
      new Date(),
    )
    expect((await reorder(ids)).body.error.code).toBe(
      'IMAGE_UPLOAD_NOT_ALLOWED_FOR_STATUS',
    )
  })

  it('deletes in archived state, compacts positions and completes the outbox', async () => {
    const owner = await createOwnerPublication()
    const uploaded = await uploadFiles(owner, [validJpeg, validPng, validWebp])
    const ids = (uploaded.body.images as Array<{ id: string }>).map(
      (item) => item.id,
    )
    await publications.updateStatus(
      owner.publicationId,
      'ARCHIVED',
      null,
      new Date(),
    )

    const anonymousContent = await request(app).get(
      `/api/v1/publication-images/${ids[0]}/content`,
    )
    expect(anonymousContent.status).toBe(404)
    expect(
      (
        await request(app)
          .get(`/api/v1/publication-images/${ids[0]}/content`)
          .set('Cookie', owner.cookie)
      ).status,
    ).toBe(200)

    const deleted = await request(app)
      .delete(`/api/v1/publications/${owner.publicationId}/images/${ids[1]}`)
      .set('Origin', env.WEB_ORIGIN)
      .set('Cookie', owner.cookie)
    expect(deleted.status).toBe(204)
    expect(
      (await images.listByPublication(owner.publicationId)).map(
        (item) => item.position,
      ),
    ).toEqual([0, 1])
    const jobs = await database.select().from(schema.storageDeletionJobs)
    expect(jobs).toHaveLength(2)
    expect(jobs.every((job) => job.completedAt !== null)).toBe(true)
  })

  it('rejects cross-owner and missing deletes without changing metadata', async () => {
    const owner = await createOwnerPublication()
    const other = await createAuthenticatedUser()
    const uploaded = await uploadFiles(owner, [validJpeg])
    const imageId = (uploaded.body.images[0] as { id: string }).id
    const endpoint = `/api/v1/publications/${owner.publicationId}/images/${imageId}`

    expect(
      (
        await request(app)
          .delete(endpoint)
          .set('Origin', env.WEB_ORIGIN)
          .set('Cookie', other.cookie)
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .delete(
            `/api/v1/publications/${owner.publicationId}/images/${randomUUID()}`,
          )
          .set('Origin', env.WEB_ORIGIN)
          .set('Cookie', owner.cookie)
      ).status,
    ).toBe(404)
    expect(await images.listByPublication(owner.publicationId)).toHaveLength(1)
  })

  it('compensates storage writes when storage or PostgreSQL insertion fails', async () => {
    const owner = await createOwnerPublication()
    const writeFailure = new FaultInjectingStorage(storage, { failWriteAt: 2 })
    const storageFailureApp = createTestApp(writeFailure, images)
    expect(
      (await uploadFiles(owner, [validJpeg], storageFailureApp)).body.error
        .code,
    ).toBe('STORAGE_OPERATION_FAILED')
    expect(await images.listByPublication(owner.publicationId)).toHaveLength(0)
    expect(await storedWebpFiles()).toHaveLength(0)

    const databaseFailureApp = createTestApp(
      storage,
      imageRepositoryWithInsertFailure(images),
    )
    expect(
      (await uploadFiles(owner, [validJpeg], databaseFailureApp)).status,
    ).toBe(500)
    expect(await images.listByPublication(owner.publicationId)).toHaveLength(0)
    expect(await storedWebpFiles()).toHaveLength(0)
  })

  it('leaves deletion jobs pending when physical deletion fails', async () => {
    const owner = await createOwnerPublication()
    const failingStorage = new FaultInjectingStorage(storage, {
      failDelete: true,
    })
    const failingApp = createTestApp(failingStorage, images)
    const uploaded = await uploadFiles(owner, [validJpeg], failingApp)
    const imageId = (uploaded.body.images[0] as { id: string }).id
    expect(
      (
        await request(failingApp)
          .delete(
            `/api/v1/publications/${owner.publicationId}/images/${imageId}`,
          )
          .set('Origin', env.WEB_ORIGIN)
          .set('Cookie', owner.cookie)
      ).status,
    ).toBe(204)

    const jobs = await database.select().from(schema.storageDeletionJobs)
    expect(jobs).toHaveLength(2)
    expect(jobs.every((job) => job.completedAt === null)).toBe(true)
    expect(jobs.every((job) => job.attempts === 1)).toBe(true)
    expect(
      jobs.every((job) => job.lastError === 'storage deletion failed'),
    ).toBe(true)
  })

  it('hides archived content from other owners and sanitizes missing storage failures', async () => {
    const owner = await createOwnerPublication()
    const other = await createAuthenticatedUser()
    const uploaded = await uploadFiles(owner, [validJpeg])
    const imageId = (uploaded.body.images[0] as { id: string }).id
    const [record] = await images.listByPublication(owner.publicationId)
    if (!record) throw new Error('Expected uploaded image metadata')

    await storage.delete(record.storageKey)
    const missing = await request(app).get(
      `/api/v1/publication-images/${imageId}/content`,
    )
    expect(missing.status).toBe(503)
    expect(JSON.stringify(missing.body)).not.toContain(record.storageKey)
    expect(JSON.stringify(missing.body)).not.toContain(storageRoot)

    await publications.updateStatus(
      owner.publicationId,
      'ARCHIVED',
      null,
      new Date(),
    )
    expect(
      (
        await request(app)
          .get(`/api/v1/publication-images/${imageId}/thumbnail`)
          .set('Cookie', other.cookie)
      ).status,
    ).toBe(404)
  })
})

async function createAuthenticatedUser() {
  const user = await users.create({
    name: 'Image owner',
    email: `${randomUUID()}@example.test`,
  })
  const sessionToken = createSessionToken()
  await sessions.create({
    userId: user.id,
    tokenHash: sessionToken.tokenHash,
    expiresAt: sessionToken.expiresAt,
  })
  return {
    user,
    cookie: `red_huella_session=${sessionToken.token}`,
  }
}

async function createOwnerPublication() {
  const authenticated = await createAuthenticatedUser()
  const publication = await publications.createWithAnimal(
    {
      userId: authenticated.user.id,
      type: 'LOST',
      title: 'Publication image integration',
      eventDate: new Date('2026-01-01T00:00:00Z'),
    },
    { species: 'DOG' },
  )
  return {
    cookie: authenticated.cookie,
    publicationId: publication.publication.id,
  }
}

function uploadFiles(
  owner: { publicationId: string; cookie: string },
  files: readonly Buffer[],
  targetApp = app,
) {
  let upload = request(targetApp)
    .post(`/api/v1/publications/${owner.publicationId}/images`)
    .set('Origin', env.WEB_ORIGIN)
    .set('Cookie', owner.cookie)
  for (const [index, file] of files.entries())
    upload = upload.attach('images', file, `client-${index}.jpg`)
  return upload
}

function createTestApp(
  imageStorage: ImageStorage,
  imageRepository: ImageRepository,
) {
  const shared = { users, sessions, publications, images: imageRepository }
  return createApp({
    authRouter: Router(),
    publicationRouter: createPublicationRouter({
      ...shared,
      imageProcessor: new SharpImageProcessor(),
      imageStorage,
    }),
    publicationImageContentRouter: createPublicationImageContentRouter({
      users,
      sessions,
      images: imageRepository,
      storage: imageStorage,
    }),
  })
}

class FaultInjectingStorage implements ImageStorage {
  private writes = 0

  constructor(
    private readonly delegate: ImageStorage,
    private readonly faults: { failWriteAt?: number; failDelete?: boolean },
  ) {}

  async write(input: WriteImageObjectInput): Promise<void> {
    this.writes += 1
    if (this.writes === this.faults.failWriteAt)
      throw new Error('synthetic storage write failure')
    await this.delegate.write(input)
  }

  read(key: string) {
    return this.delegate.read(key)
  }

  async delete(key: string): Promise<void> {
    if (this.faults.failDelete)
      throw new Error('synthetic storage delete failure')
    await this.delegate.delete(key)
  }
}

function imageRepositoryWithInsertFailure(
  delegate: ImageRepository,
): ImageRepository {
  return {
    listByPublication: delegate.listByPublication.bind(delegate),
    insertWithCapacity: async () => {
      throw new Error('synthetic database insertion failure')
    },
    deleteWithOutbox: delegate.deleteWithOutbox.bind(delegate),
    reorder: delegate.reorder.bind(delegate),
    findContentById: delegate.findContentById.bind(delegate),
    findPendingDeletionJobs: delegate.findPendingDeletionJobs.bind(delegate),
    markDeletionJobCompleted: delegate.markDeletionJobCompleted.bind(delegate),
    markDeletionJobFailed: delegate.markDeletionJobFailed.bind(delegate),
  }
}

async function storedWebpFiles(): Promise<string[]> {
  return (await readdir(storageRoot, { recursive: true })).filter((entry) =>
    entry.endsWith('.webp'),
  )
}

function fixture() {
  return sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 4,
      background: { r: 40, g: 120, b: 200, alpha: 0.8 },
    },
  })
}
