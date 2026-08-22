import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { count, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.js'
import { env } from '../config/index.js'
import * as schema from '../database/schema/index.js'
import { assertSafeTestDatabaseUrl } from '../database/test-database.js'
import { DrizzleAuthRegistrationRepository } from '../repositories/drizzle-auth-registration.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { createAuthRouter } from '../routes/auth.routes.js'
import { createPublicationRouter } from '../routes/publication.routes.js'

const pool = new Pool({
  connectionString: assertSafeTestDatabaseUrl(env),
  max: 2,
})
const database = drizzle({ client: pool, schema })
const users = new DrizzleUserRepository(database)
const sessions = new DrizzleSessionRepository(database)
const registrations = new DrizzleAuthRegistrationRepository(database)
const publications = new DrizzlePublicationRepository(database)
const app = createApp({
  authRouter: createAuthRouter({ users, sessions, registrations }),
  publicationRouter: createPublicationRouter({ users, sessions, publications }),
})

async function register(email: string) {
  const agent = request.agent(app)
  const response = await agent
    .post('/api/v1/auth/register')
    .set('Origin', env.WEB_ORIGIN)
    .send({ name: email.split('@')[0], email, password: 'a secure passphrase' })
  expect(response.status).toBe(201)
  return { agent, userId: response.body.user.id as string }
}

function payload(type: 'LOST' | 'FOUND' | 'ADOPTION', title: string) {
  return {
    type,
    title,
    description: 'Descripción suficientemente detallada',
    eventDate: '2026-08-20T10:00:00Z',
    location: { latitude: 41.683, longitude: 2.285 },
    animal: {
      name: title,
      species: type === 'ADOPTION' ? 'CAT' : 'DOG',
      sex: 'UNKNOWN',
      size: 'MEDIUM',
      approximateAge: 5,
    },
  }
}

beforeAll(async () =>
  migrate(database, {
    migrationsFolder: fileURLToPath(
      new URL('../database/migrations', import.meta.url),
    ),
  }),
)
beforeEach(async () => {
  await database.delete(schema.sessions)
  await database.delete(schema.publicationImages)
  await database.delete(schema.publications)
  await database.delete(schema.animals)
  await database.delete(schema.users)
})
afterAll(async () => pool.end())

describe('publication HTTP API with PostgreSQL', () => {
  it('creates each type atomically, returns a safe DTO and supports public filters/pagination/order', async () => {
    const { agent, userId } = await register('owner@example.test')
    for (const [type, title] of [
      ['LOST', 'Perro perdido'],
      ['FOUND', 'Perro encontrado'],
      ['ADOPTION', 'Gato en adopción'],
    ] as const) {
      const response = await agent
        .post('/api/v1/publications')
        .set('Origin', env.WEB_ORIGIN)
        .send({
          ...payload(type, title),
          userId: '00000000-0000-4000-8000-000000000000',
        })
      expect(response.status).toBe(400)
      const accepted = await agent
        .post('/api/v1/publications')
        .set('Origin', env.WEB_ORIGIN)
        .send(payload(type, title))
      expect(accepted.status).toBe(201)
      expect(accepted.body.publication.author).toEqual({
        id: userId,
        name: 'owner',
        role: 'USER',
      })
      expect(accepted.body.publication.author).not.toHaveProperty('email')
    }
    const list = await request(app).get('/api/v1/publications').query({
      page: 1,
      pageSize: 1,
      type: 'ADOPTION',
      species: 'CAT',
      order: 'oldest',
    })
    expect(list.status).toBe(200)
    expect(list.body.items).toHaveLength(1)
    expect(list.body.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    })
    const get = await request(app).get(
      `/api/v1/publications/${list.body.items[0].id as string}`,
    )
    expect(get.status).toBe(200)
    expect(get.body.publication).not.toHaveProperty('userId')
  })

  it('enforces authentication, Origin and ownership for update and status transitions', async () => {
    const owner = await register('a@example.test')
    const other = await register('b@example.test')
    const created = await owner.agent
      .post('/api/v1/publications')
      .set('Origin', env.WEB_ORIGIN)
      .send(payload('LOST', 'Perro de A'))
    const id = created.body.publication.id as string
    expect(
      (
        await request(app)
          .patch(`/api/v1/publications/${id}`)
          .set('Origin', env.WEB_ORIGIN)
          .send({ title: 'Cambio anónimo' })
      ).status,
    ).toBe(401)
    expect(
      (
        await owner.agent
          .patch(`/api/v1/publications/${id}`)
          .set('Origin', 'https://evil.example')
          .send({ title: 'Origen malo' })
      ).status,
    ).toBe(403)
    expect(
      (
        await other.agent
          .patch(`/api/v1/publications/${id}`)
          .set('Origin', env.WEB_ORIGIN)
          .send({ title: 'Cambio ajeno' })
      ).status,
    ).toBe(403)
    expect(
      (
        await other.agent
          .patch(`/api/v1/publications/${id}/status`)
          .set('Origin', env.WEB_ORIGIN)
          .send({ status: 'RESOLVED' })
      ).status,
    ).toBe(403)
    const updated = await owner.agent
      .patch(`/api/v1/publications/${id}`)
      .set('Origin', env.WEB_ORIGIN)
      .send({ title: 'Título propio editado', animal: { color: 'Marrón' } })
    expect(updated.status).toBe(200)
    expect(updated.body.publication.animal.color).toBe('Marrón')
    expect(
      (
        await owner.agent
          .patch(`/api/v1/publications/${id}/status`)
          .set('Origin', env.WEB_ORIGIN)
          .send({ status: 'ADOPTED' })
      ).status,
    ).toBe(400)
    const resolved = await owner.agent
      .patch(`/api/v1/publications/${id}/status`)
      .set('Origin', env.WEB_ORIGIN)
      .send({ status: 'RESOLVED' })
    expect(resolved.status).toBe(200)
    expect(resolved.body.publication.resolvedAt).not.toBeNull()
    const mine = await owner.agent.get('/api/v1/publications/mine')
    expect(mine.body.items).toHaveLength(1)
    expect(
      (await other.agent.get('/api/v1/publications/mine')).body.items,
    ).toHaveLength(0)

    const archivedCandidate = await owner.agent
      .post('/api/v1/publications')
      .set('Origin', env.WEB_ORIGIN)
      .send(payload('ADOPTION', 'Animal para archivar'))
    const archivedId = archivedCandidate.body.publication.id as string
    const archived = await owner.agent
      .patch(`/api/v1/publications/${archivedId}/status`)
      .set('Origin', env.WEB_ORIGIN)
      .send({ status: 'ARCHIVED' })
    expect(archived.status).toBe(200)
    expect(archived.body.publication.resolvedAt).toBeNull()
    expect(
      (await request(app).get(`/api/v1/publications/${archivedId}`)).status,
    ).toBe(404)
    expect(
      (await request(app).get('/api/v1/publications')).body.items,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: archivedId })]),
    )
    expect(
      (await owner.agent.get('/api/v1/publications/mine')).body.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: archivedId, status: 'ARCHIVED' }),
      ]),
    )
  })

  it('applies location privacy on create and exposes exact location only through owner manage', async () => {
    const owner = await register('geo-owner@example.test')
    const other = await register('geo-other@example.test')

    for (const type of ['LOST', 'FOUND', 'ADOPTION'] as const) {
      const created = await owner.agent
        .post('/api/v1/publications')
        .set('Origin', env.WEB_ORIGIN)
        .send(payload(type, `Ubicación ${type}`))
      expect(created.status).toBe(201)
      expect(created.body.publication.publicLocation.radiusMeters).toBe(
        type === 'LOST' ? 1_000 : type === 'FOUND' ? 1_500 : 5_000,
      )
      expect(created.body.publication).not.toHaveProperty('exactLocation')
      const id = created.body.publication.id as string
      const persisted = await publications.findById(id)
      expect(persisted?.exactLocation === null).toBe(type === 'ADOPTION')

      const manage = await owner.agent.get(`/api/v1/publications/${id}/manage`)
      expect(manage.status).toBe(200)
      expect(manage.headers['cache-control']).toBe('private, no-store')
      expect(manage.body.publication.exactLocation === null).toBe(
        type === 'ADOPTION',
      )
      expect(manage.body.publication).not.toHaveProperty(
        'locationPrivacyVersion',
      )
      expect(JSON.stringify(manage.body)).not.toMatch(/EWK[BT]|geography/i)
      expect(
        (await request(app).get(`/api/v1/publications/${id}/manage`)).status,
      ).toBe(401)
      expect(
        (await other.agent.get(`/api/v1/publications/${id}/manage`)).status,
      ).toBe(403)
    }

    const withoutLocation = await owner.agent
      .post('/api/v1/publications')
      .set('Origin', env.WEB_ORIGIN)
      .send({ ...payload('LOST', 'Sin ubicación'), location: undefined })
    expect(withoutLocation.status).toBe(201)
    expect(withoutLocation.body.publication.publicLocation).toBeNull()

    for (const protectedField of [
      'exactLocation',
      'publicLocation',
      'publicLocationRadiusMeters',
      'locationPrivacyVersion',
      'geography',
      'WKT',
      'EWKT',
      'EWKB',
    ]) {
      const rejected = await owner.agent
        .post('/api/v1/publications')
        .set('Origin', env.WEB_ORIGIN)
        .send({
          ...payload('LOST', `Campo protegido ${protectedField}`),
          [protectedField]: 'POINT(0 0)',
        })
      expect(rejected.status).toBe(400)
    }
  })

  it('updates locations stably and reapplies privacy for the final type atomically', async () => {
    const owner = await register('geo-update@example.test')
    const other = await register('geo-update-other@example.test')
    const created = await owner.agent
      .post('/api/v1/publications')
      .set('Origin', env.WEB_ORIGIN)
      .send(payload('LOST', 'Ubicación editable'))
    const id = created.body.publication.id as string
    const firstManage = await owner.agent.get(
      `/api/v1/publications/${id}/manage`,
    )
    const firstPublic = firstManage.body.publication.publicLocation as {
      latitude: number
      longitude: number
      radiusMeters: number
    }

    const kept = await owner.agent
      .patch(`/api/v1/publications/${id}`)
      .set('Origin', env.WEB_ORIGIN)
      .send({
        location: {
          latitude: firstPublic.latitude,
          longitude: firstPublic.longitude,
        },
      })
    expect(kept.status).toBe(200)
    expect(kept.body.publication.publicLocation).toEqual(firstPublic)

    const regenerated = await owner.agent
      .patch(`/api/v1/publications/${id}`)
      .set('Origin', env.WEB_ORIGIN)
      .send({ location: { latitude: 10, longitude: 10 } })
    expect(regenerated.status).toBe(200)
    expect(regenerated.body.publication.publicLocation).not.toEqual(firstPublic)

    expect(
      (
        await other.agent
          .patch(`/api/v1/publications/${id}`)
          .set('Origin', env.WEB_ORIGIN)
          .send({ location: { latitude: 0, longitude: 0 } })
      ).status,
    ).toBe(403)
    expect(
      (
        await owner.agent
          .patch(`/api/v1/publications/${id}`)
          .set('Origin', env.WEB_ORIGIN)
          .send({ location: { latitude: 91, longitude: 0 } })
      ).status,
    ).toBe(400)

    const adoption = await owner.agent
      .patch(`/api/v1/publications/${id}`)
      .set('Origin', env.WEB_ORIGIN)
      .send({ type: 'ADOPTION' })
    expect(adoption.status).toBe(200)
    expect(adoption.body.publication.publicLocation.radiusMeters).toBe(5_000)
    expect((await publications.findById(id))?.exactLocation).toBeNull()

    expect(
      (
        await owner.agent
          .patch(`/api/v1/publications/${id}`)
          .set('Origin', env.WEB_ORIGIN)
          .send({ type: 'LOST' })
      ).status,
    ).toBe(400)
    const lostAgain = await owner.agent
      .patch(`/api/v1/publications/${id}`)
      .set('Origin', env.WEB_ORIGIN)
      .send({
        type: 'LOST',
        location: { latitude: 40.4, longitude: -3.7 },
      })
    expect(lostAgain.status).toBe(200)
    expect((await publications.findById(id))?.exactLocation).not.toBeNull()

    const removed = await owner.agent
      .patch(`/api/v1/publications/${id}`)
      .set('Origin', env.WEB_ORIGIN)
      .send({ location: null })
    expect(removed.status).toBe(200)
    expect(removed.body.publication.publicLocation).toBeNull()
    expect((await publications.findById(id))?.exactLocation).toBeNull()
  })

  it('searches and orders exclusively by public_location with rounded public distance', async () => {
    const user = await users.create({
      name: 'Geo Search',
      email: 'geo-search@example.test',
    })
    const createSpatial = async (input: {
      title: string
      type?: 'LOST' | 'FOUND'
      species?: 'DOG' | 'CAT'
      exact: { latitude: number; longitude: number }
      publicPoint?: { latitude: number; longitude: number }
    }) =>
      publications.createWithAnimal(
        {
          userId: user.id,
          type: input.type ?? 'LOST',
          title: input.title,
          eventDate: new Date('2026-08-20T10:00:00Z'),
          exactLocation: input.exact,
          publicLocation: input.publicPoint
            ? { ...input.publicPoint, radiusMeters: 1_000 }
            : null,
          locationPrivacyVersion: input.publicPoint ? 1 : null,
        },
        { species: input.species ?? 'DOG' },
      )

    const exactFarPublicNear = await createSpatial({
      title: 'Exacta lejos, pública cerca',
      exact: { latitude: 50, longitude: 50 },
      publicPoint: { latitude: 0, longitude: 0.0044 },
    })
    await createSpatial({
      title: 'Exacta cerca, pública lejos',
      exact: { latitude: 0, longitude: 0 },
      publicPoint: { latitude: 1, longitude: 1 },
    })
    const sameDistanceOlder = await createSpatial({
      title: 'Misma distancia anterior',
      exact: { latitude: 20, longitude: 20 },
      publicPoint: { latitude: 0, longitude: 0.0044 },
    })
    const withoutPublic = await createSpatial({
      title: 'Sin ubicación pública',
      exact: { latitude: 0, longitude: 0 },
    })
    const archived = await createSpatial({
      title: 'Archivada cercana',
      exact: { latitude: 30, longitude: 30 },
      publicPoint: { latitude: 0, longitude: 0.001 },
    })
    await database
      .update(schema.publications)
      .set({ createdAt: new Date('2026-01-01T00:00:00Z') })
      .where(eq(schema.publications.id, exactFarPublicNear.publication.id))
    await database
      .update(schema.publications)
      .set({ createdAt: new Date('2026-01-02T00:00:00Z') })
      .where(eq(schema.publications.id, sameDistanceOlder.publication.id))
    await publications.updateStatus(
      archived.publication.id,
      'ARCHIVED',
      null,
      new Date(),
    )

    const search = await request(app).get('/api/v1/publications').query({
      latitude: 0,
      longitude: 0,
      radiusMeters: 500,
      type: 'LOST',
      species: 'DOG',
      status: 'ACTIVE',
      order: 'distance',
    })
    expect(search.status).toBe(200)
    expect(search.body.items.map((item: { id: string }) => item.id)).toEqual([
      sameDistanceOlder.publication.id,
      exactFarPublicNear.publication.id,
    ])
    expect(search.body.items[0].distanceMeters % 100).toBe(0)
    expect(search.body.items[0].distanceMeters).toBe(500)
    expect(search.body.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: withoutPublic.publication.id }),
        expect.objectContaining({ id: archived.publication.id }),
      ]),
    )
    const serialized = JSON.stringify(search.body)
    expect(serialized).not.toMatch(
      /exactLocation|exact_location|latitude":50|longitude":50|EWK[BT]|POINT\(/,
    )

    for (const radiusMeters of [500, 100_000])
      expect(
        (
          await request(app).get('/api/v1/publications').query({
            latitude: 0,
            longitude: 0,
            radiusMeters,
          })
        ).status,
      ).toBe(200)
    for (const query of [
      { latitude: 0 },
      { latitude: 0, longitude: 0 },
      { radiusMeters: 1_000 },
      { order: 'distance' },
      { latitude: 0, longitude: 0, radiusMeters: 499 },
      { latitude: 0, longitude: 0, radiusMeters: 100_001 },
      { latitude: 'NaN', longitude: 0, radiusMeters: 500 },
      { latitude: 'Infinity', longitude: 0, radiusMeters: 500 },
    ])
      expect(
        (await request(app).get('/api/v1/publications').query(query)).status,
      ).toBe(400)
  })

  it('serves the minimal map viewport DTO from public_location, including antimeridian and thumbnail', async () => {
    const user = await users.create({
      name: 'Map Owner',
      email: 'map-owner@example.test',
    })
    const createMapPublication = async (input: {
      title: string
      publicPoint: { latitude: number; longitude: number }
      exactPoint: { latitude: number; longitude: number }
      species?: 'DOG' | 'CAT'
      status?: 'ACTIVE' | 'RESOLVED' | 'ADOPTED' | 'ARCHIVED'
    }) => {
      const created = await publications.createWithAnimal(
        {
          userId: user.id,
          type: input.status === 'ADOPTED' ? 'ADOPTION' : 'LOST',
          title: input.title,
          description: 'No debe aparecer en el mapa',
          eventDate: new Date('2026-08-20T10:00:00Z'),
          exactLocation: input.exactPoint,
          publicLocation: { ...input.publicPoint, radiusMeters: 1_000 },
          locationPrivacyVersion: 1,
          status: input.status ?? 'ACTIVE',
        },
        { name: 'Luna', species: input.species ?? 'DOG', breed: 'Mestizo' },
      )
      return created
    }

    const publicInside = await createMapPublication({
      title: 'PÃºblica dentro, exacta fuera',
      publicPoint: { latitude: 40.4, longitude: -3.7 },
      exactPoint: { latitude: 10, longitude: 10 },
    })
    const exactInside = await createMapPublication({
      title: 'Exacta dentro, pÃºblica fuera',
      publicPoint: { latitude: 20, longitude: 20 },
      exactPoint: { latitude: 40.4, longitude: -3.7 },
    })
    const eastern = await createMapPublication({
      title: 'Este del antimeridiano',
      publicPoint: { latitude: 0, longitude: 179.5 },
      exactPoint: { latitude: 0, longitude: 0 },
    })
    const western = await createMapPublication({
      title: 'Oeste del antimeridiano',
      publicPoint: { latitude: 0, longitude: -179.5 },
      exactPoint: { latitude: 0, longitude: 0 },
    })
    await createMapPublication({
      title: 'Archivada',
      publicPoint: { latitude: 40.41, longitude: -3.71 },
      exactPoint: { latitude: 40.41, longitude: -3.71 },
      status: 'ARCHIVED',
    })
    const resolved = await createMapPublication({
      title: 'Resuelta visible bajo filtro',
      publicPoint: { latitude: 40.5, longitude: -3.5 },
      exactPoint: { latitude: 0, longitude: 0 },
      status: 'RESOLVED',
    })
    const adopted = await createMapPublication({
      title: 'Adoptada visible bajo filtro',
      publicPoint: { latitude: 40.6, longitude: -3.6 },
      exactPoint: { latitude: 0, longitude: 0 },
      species: 'CAT',
      status: 'ADOPTED',
    })
    const withoutPublic = await publications.createWithAnimal(
      {
        userId: user.id,
        type: 'LOST',
        title: 'Sin ubicación pública',
        eventDate: new Date('2026-08-20T10:00:00Z'),
        exactLocation: { latitude: 40.4, longitude: -3.7 },
      },
      { species: 'DOG' },
    )
    const thumbnailId = randomUUID()
    await database.insert(schema.publicationImages).values({
      id: thumbnailId,
      publicationId: publicInside.publication.id,
      storageKey: `publications/${publicInside.publication.id}/display.webp`,
      thumbnailStorageKey: `publications/${publicInside.publication.id}/thumbnail.webp`,
      mimeType: 'image/webp',
      displayWidth: 1_024,
      displayHeight: 768,
      displayByteSize: 100,
      displayChecksumSha256: 'a'.repeat(64),
      thumbnailWidth: 640,
      thumbnailHeight: 480,
      thumbnailByteSize: 50,
      thumbnailChecksumSha256: 'b'.repeat(64),
      position: 0,
    })

    const response = await request(app).get('/api/v1/publications/map').query({
      north: 41,
      south: 40,
      west: -4,
      east: -3,
      type: 'LOST',
      species: 'DOG',
    })
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe(
      'public, no-cache, max-age=0, must-revalidate',
    )
    expect(response.headers.etag).toEqual(expect.any(String))
    expect(response.body).toMatchObject({ truncated: false, limit: 500 })
    expect(response.body.publications).toHaveLength(1)
    expect(response.body.publications[0]).toEqual({
      id: publicInside.publication.id,
      type: 'LOST',
      status: 'ACTIVE',
      title: 'PÃºblica dentro, exacta fuera',
      eventDate: '2026-08-20T10:00:00.000Z',
      publicLocation: { lat: 40.4, long: -3.7, radius: 1_000 },
      animal: { name: 'Luna', species: 'DOG', breed: 'Mestizo' },
      thumbnail: {
        url: `/api/v1/publication-images/${thumbnailId}/thumbnail`,
        width: 640,
        height: 480,
      },
    })
    const serialized = JSON.stringify(response.body)
    for (const forbidden of [
      exactInside.publication.id,
      withoutPublic.publication.id,
      'description',
      'author',
      'userId',
      'exactLocation',
      'storageKey',
      'contact',
      'sex',
    ])
      expect(serialized).not.toContain(forbidden)

    const inclusiveBoundary = await request(app)
      .get('/api/v1/publications/map')
      .query({ north: 40.4, south: 40, west: -3.7, east: -3 })
    expect(inclusiveBoundary.body.publications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: publicInside.publication.id }),
      ]),
    )

    const antimeridian = await request(app)
      .get('/api/v1/publications/map')
      .query({ north: 1, south: -1, west: 170, east: -170 })
    expect(
      antimeridian.body.publications.map((item: { id: string }) => item.id),
    ).toEqual(
      expect.arrayContaining([eastern.publication.id, western.publication.id]),
    )

    const resolvedResponse = await request(app)
      .get('/api/v1/publications/map')
      .query({ north: 41, south: 40, west: -4, east: -3, status: 'RESOLVED' })
    expect(resolvedResponse.body.publications).toEqual([
      expect.objectContaining({
        id: resolved.publication.id,
        status: 'RESOLVED',
      }),
    ])
    const adoptedResponse = await request(app)
      .get('/api/v1/publications/map')
      .query({
        north: 41,
        south: 40,
        west: -4,
        east: -3,
        status: 'ADOPTED',
        type: 'ADOPTION',
        species: 'CAT',
      })
    expect(adoptedResponse.body.publications).toEqual([
      expect.objectContaining({
        id: adopted.publication.id,
        status: 'ADOPTED',
      }),
    ])

    for (const query of [
      { north: 41, south: 40, west: -4 },
      { north: 41, south: 40, west: -4, east: -3, status: 'ARCHIVED' },
      { north: 41, south: 40, west: -4, east: -3, page: 1 },
      { north: 41, south: 40, west: -4, east: -3, latitude: 40.4 },
    ])
      expect(
        (await request(app).get('/api/v1/publications/map').query(query))
          .status,
      ).toBe(400)
  })

  it('rolls back animal creation when publication insertion fails', async () => {
    const user = await users.create({
      name: 'Rollback',
      email: 'rollback@example.test',
    })
    await expect(
      publications.createWithAnimal(
        {
          userId: user.id,
          type: 'LOST',
          title: '',
          eventDate: new Date('2026-08-20T10:00:00Z'),
        },
        { species: 'DOG' },
      ),
    ).rejects.toBeDefined()
    const [row] = await database.select({ value: count() }).from(schema.animals)
    expect(row?.value).toBe(0)
  })

  it('rolls back a compound update when the animal change violates a database invariant', async () => {
    const user = await users.create({
      name: 'Atomic Update',
      email: 'atomic@example.test',
    })
    const created = await publications.createWithAnimal(
      {
        userId: user.id,
        type: 'FOUND',
        title: 'Título anterior',
        eventDate: new Date('2026-08-20T10:00:00Z'),
      },
      { species: 'DOG', approximateAge: 2 },
    )
    await expect(
      publications.updateWithAnimal(
        created.publication.id,
        { title: 'Título que debe revertirse', updatedAt: new Date() },
        { approximateAge: -1 },
      ),
    ).rejects.toBeDefined()
    const persisted = await publications.findAggregateById(
      created.publication.id,
    )
    expect(persisted?.publication.title).toBe('Título anterior')
    expect(persisted?.animal.approximateAge).toBe(2)
  })
})
