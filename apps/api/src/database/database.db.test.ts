import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { env } from '../config/index.js'
import { DatabaseError } from '../errors/app-error.js'
import { DrizzleAnimalRepository } from '../repositories/drizzle-animal.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { assertSafeTestDatabaseUrl } from './test-database.js'
import * as schema from './schema/index.js'

const testDatabaseUrl = assertSafeTestDatabaseUrl(env)
const testPool = new Pool({ connectionString: testDatabaseUrl, max: 2 })
const testDatabase = drizzle({ client: testPool, schema })
const userRepository = new DrizzleUserRepository(testDatabase)
const animalRepository = new DrizzleAnimalRepository(testDatabase)
const publicationRepository = new DrizzlePublicationRepository(testDatabase)
const sessionRepository = new DrizzleSessionRepository(testDatabase)

async function createPublicationFixture() {
  const user = await userRepository.create({
    name: 'Integration User',
    email: `${randomUUID()}@example.test`,
  })
  const animal = await animalRepository.create({ species: 'DOG' })
  return { user, animal }
}

beforeAll(async () => {
  await migrate(testDatabase, {
    migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)),
  })
})

beforeEach(async () => {
  await testDatabase.delete(schema.storageDeletionJobs)
  await testDatabase.delete(schema.sessions)
  await testDatabase.delete(schema.publicationImages)
  await testDatabase.delete(schema.publications)
  await testDatabase.delete(schema.animals)
  await testDatabase.delete(schema.users)
})

afterAll(async () => {
  await testPool.end()
})

describe('PostgreSQL persistence', () => {
  it('has the initial migration applied', async () => {
    const result = await testPool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
       and table_name in ('users', 'animals', 'publications', 'publication_images', 'sessions', 'storage_deletion_jobs')`,
    )
    expect(result.rows.map((row) => row.table_name).sort()).toEqual([
      'animals',
      'publication_images',
      'publications',
      'sessions',
      'storage_deletion_jobs',
      'users',
    ])
  })

  it('persists only a session token hash and enforces uniqueness, expiry and revocation', async () => {
    const user = await userRepository.create({
      name: 'Session User',
      email: 'session@example.test',
      passwordHash: '$argon2id$fixture',
    })
    const now = new Date()
    const tokenHash = 'a'.repeat(64)
    const session = await sessionRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(now.getTime() + 60_000),
    })
    await expect(
      sessionRepository.findActiveByTokenHash(tokenHash, now),
    ).resolves.toEqual(session)
    await expect(
      sessionRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(now.getTime() + 60_000),
      }),
    ).rejects.toBeInstanceOf(DatabaseError)
    await sessionRepository.revokeByTokenHash(tokenHash, now)
    await expect(
      sessionRepository.findActiveByTokenHash(tokenHash, now),
    ).resolves.toBeUndefined()

    const expiredHash = 'b'.repeat(64)
    await testDatabase.insert(schema.sessions).values({
      userId: user.id,
      tokenHash: expiredHash,
      createdAt: new Date(now.getTime() - 120_000),
      expiresAt: new Date(now.getTime() - 60_000),
    })
    await expect(
      sessionRepository.findActiveByTokenHash(expiredHash, now),
    ).resolves.toBeUndefined()
    await expect(
      sessionRepository.deleteExpired(now),
    ).resolves.toBeGreaterThanOrEqual(1)
  })

  it('normalizes email, inserts a user and finds it by UUID', async () => {
    const created = await userRepository.create({
      name: '  Persona Test  ',
      email: '  PERSONA@EXAMPLE.TEST ',
    })
    expect(created.email).toBe('persona@example.test')
    await expect(userRepository.findById(created.id)).resolves.toEqual(created)
  })

  it('enforces case-insensitive email uniqueness through normalization', async () => {
    await userRepository.create({ name: 'One', email: 'unique@example.test' })
    await expect(
      userRepository.create({ name: 'Two', email: 'UNIQUE@EXAMPLE.TEST' }),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  it('inserts and retrieves animals and publications with valid foreign keys', async () => {
    const { user, animal } = await createPublicationFixture()
    const publication = await publicationRepository.create({
      userId: user.id,
      animalId: animal.id,
      type: 'LOST',
      title: 'Lost animal integration fixture',
      eventDate: new Date('2026-01-01T00:00:00Z'),
      latitude: 40.4,
      longitude: -3.7,
    })

    await expect(animalRepository.findById(animal.id)).resolves.toEqual(animal)
    await expect(
      publicationRepository.findById(publication.id),
    ).resolves.toEqual(publication)
  })

  it('rejects publications with missing foreign keys', async () => {
    await expect(
      publicationRepository.create({
        userId: randomUUID(),
        animalId: randomUUID(),
        type: 'FOUND',
        title: 'Invalid foreign keys',
        eventDate: new Date(),
      }),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  it.each([
    { latitude: -90.1, longitude: 0 },
    { latitude: 0, longitude: 180.1 },
    { latitude: 40, longitude: null },
  ])('rejects invalid coordinates: %s', async (coordinates) => {
    const { user, animal } = await createPublicationFixture()
    await expect(
      publicationRepository.create({
        userId: user.id,
        animalId: animal.id,
        type: 'LOST',
        title: 'Invalid coordinates',
        eventDate: new Date(),
        ...coordinates,
      }),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  it('stores neutral image keys and enforces non-negative positions', async () => {
    const { user, animal } = await createPublicationFixture()
    const publication = await publicationRepository.create({
      userId: user.id,
      animalId: animal.id,
      type: 'ADOPTION',
      title: 'Image persistence fixture',
      eventDate: new Date(),
    })

    const [image] = await testDatabase
      .insert(schema.publicationImages)
      .values({
        publicationId: publication.id,
        storageKey: 'tests/image-01.jpg',
        position: 0,
      })
      .returning()
    expect(image?.storageKey).toBe('tests/image-01.jpg')

    await expect(
      testDatabase.insert(schema.publicationImages).values({
        publicationId: publication.id,
        storageKey: 'tests/image-invalid.jpg',
        position: -1,
      }),
    ).rejects.toBeDefined()
  })

  it('enforces complete variant metadata and persists deletion outbox entries', async () => {
    const { user, animal } = await createPublicationFixture()
    const publication = await publicationRepository.create({
      userId: user.id,
      animalId: animal.id,
      type: 'LOST',
      title: 'Normalized image metadata fixture',
      eventDate: new Date(),
    })
    const imageId = randomUUID()
    const prefix = `publications/${publication.id}/${imageId}`
    const checksum = 'a'.repeat(64)

    await expect(
      testDatabase.insert(schema.publicationImages).values({
        id: imageId,
        publicationId: publication.id,
        storageKey: `${prefix}/display.webp`,
        thumbnailStorageKey: `${prefix}/thumbnail.webp`,
        mimeType: 'image/webp',
        displayWidth: 1600,
        displayHeight: 1200,
        displayByteSize: 120_000,
        displayChecksumSha256: checksum,
        thumbnailWidth: 640,
        thumbnailHeight: 480,
        thumbnailByteSize: 20_000,
        thumbnailChecksumSha256: 'b'.repeat(64),
        position: 0,
      }),
    ).resolves.toBeDefined()

    await expect(
      testDatabase.insert(schema.publicationImages).values({
        publicationId: publication.id,
        storageKey: `${prefix}/incomplete.webp`,
        mimeType: 'image/webp',
        displayWidth: 100,
        displayHeight: 100,
        displayByteSize: 100,
        displayChecksumSha256: 'invalid',
        position: 1,
      }),
    ).rejects.toBeDefined()

    const [job] = await testDatabase
      .insert(schema.storageDeletionJobs)
      .values({ storageKey: `${prefix}/display.webp` })
      .returning()
    expect(job).toMatchObject({ attempts: 0, completedAt: null })
  })
})
