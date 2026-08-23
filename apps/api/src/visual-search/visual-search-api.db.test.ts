import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
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
import { env } from '../config/index.js'
import * as schema from '../database/schema/index.js'
import { assertSafeTestDatabaseUrl } from '../database/test-database.js'
import { createPublicationRouter } from '../routes/publication.routes.js'
import { VisualSearchError } from './visual-search-errors.js'

const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(env) })
const database = drizzle({ client: pool, schema })
const embedding = Float32Array.from({ length: 512 }, (_, index) =>
  index === 0 ? 1 : 0,
)

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
  await database.delete(schema.publicationContactMethods)
  await database.delete(schema.publicationImages)
  await database.delete(schema.publications)
  await database.delete(schema.animals)
  await database.delete(schema.users)
})

afterAll(() => pool.end())

describe('POST /api/v1/publications/search-by-image', () => {
  it('requires Origin, authentication and exactly one valid multipart image', async () => {
    const app = testApp()
    const image = await validImage()
    await request(app)
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .attach('image', image, 'query.webp')
      .expect(401)

    const agent = await authenticatedAgent(app)
    await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', 'https://evil.example')
      .attach('image', image, 'query.webp')
      .expect(403)
    await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .expect(400)
    await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .attach('image', image, 'one.webp')
      .attach('image', image, 'two.webp')
      .expect(400)
    await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .attach('image', Buffer.alloc(8 * 1024 * 1024 + 1), 'huge.jpg')
      .expect(413)
  })

  it('validates bytes and strict filters with stable errors', async () => {
    const app = testApp({
      generateImageEmbeddingWithMetrics: vi
        .fn()
        .mockRejectedValue(new VisualSearchError('INVALID_IMAGE', 'sharp')),
    })
    const agent = await authenticatedAgent(app)
    const invalid = await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .attach('image', Buffer.from('<svg/>'), 'fake.jpg')
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('IMAGE_CORRUPT')

    const filters = await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .field('targetType', 'INVALID')
      .field('unknown', 'value')
      .attach('image', await validImage(), 'query.webp')
    expect(filters.status).toBe(400)
  })

  it('returns a private reduced DTO and never persists the query', async () => {
    const search = vi.fn().mockResolvedValue([
      {
        publicationId: randomUUID(),
        type: 'FOUND',
        title: 'Similar',
        eventDate: new Date('2026-08-20T00:00:00Z'),
        animalName: null,
        species: 'DOG',
        breed: null,
        primaryImageId: randomUUID(),
        matchedImageId: randomUUID(),
        publicLatitude: 40.4,
        publicLongitude: -3.7,
        publicLocationRadiusMeters: 1_500,
        visualSimilarity: 0.91,
      },
    ])
    const app = testApp(undefined, search)
    const agent = await authenticatedAgent(app)
    const before = await database
      .select()
      .from(schema.publicationImageEmbeddings)
    const response = await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .field('targetType', 'FOUND')
      .field('species', 'DOG')
      .field('limit', '5')
      .attach('image', await validImage(), 'query.webp')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers.pragma).toBe('no-cache')
    expect(response.headers).not.toHaveProperty('etag')
    expect(response.body.items[0]).toHaveProperty('matchedImage.thumbnailUrl')
    expect(JSON.stringify(response.body)).not.toMatch(
      /embedding|checksum|modelVersion|storageKey|exactLocation|email|phone/i,
    )
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'FOUND',
        species: 'DOG',
        limit: 5,
      }),
    )
    const after = await database
      .select()
      .from(schema.publicationImageEmbeddings)
    expect(after).toEqual(before)
  })

  it('returns 503 for global model failures', async () => {
    const app = testApp({
      generateImageEmbeddingWithMetrics: vi
        .fn()
        .mockRejectedValue(
          new VisualSearchError('MODEL_NOT_CONFIGURED', 'private path'),
        ),
    })
    const agent = await authenticatedAgent(app)
    const response = await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .attach('image', await validImage(), 'query.webp')
    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('VISUAL_SEARCH_UNAVAILABLE')
    expect(JSON.stringify(response.body)).not.toContain('private path')
  })

  it('enforces the dedicated per-user rate limit', async () => {
    const app = testApp(undefined, undefined, 1)
    const agent = await authenticatedAgent(app)
    const image = await validImage()
    await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .attach('image', image, 'query.webp')
      .expect(200)
    const limited = await agent
      .post('/api/v1/publications/search-by-image')
      .set('Origin', env.WEB_ORIGIN)
      .attach('image', image, 'query.webp')
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('VISUAL_SEARCH_RATE_LIMITED')
  })
})

function testApp(
  generator = {
    generateImageEmbeddingWithMetrics: vi.fn().mockResolvedValue({
      embedding,
      preprocessingMs: 1,
      inferenceMs: 2,
    }),
  },
  search = vi.fn().mockResolvedValue([]),
  userMax = 100,
) {
  return createApp({
    publicationRouter: createPublicationRouter({
      visualEmbeddingGenerator: generator,
      visualSearch: { searchSimilarPublications: search },
      visualSearchRateLimits: { userMax, ipMax: 100 },
    }),
  })
}

async function authenticatedAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app)
  await agent
    .post('/api/v1/auth/register')
    .set('Origin', env.WEB_ORIGIN)
    .send({
      name: 'Visual Search User',
      email: `${randomUUID()}@example.test`,
      password: 'Valid-password-123!',
    })
    .expect(201)
  return agent
}

function validImage() {
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: '#c86432',
    },
  })
    .webp()
    .toBuffer()
}
