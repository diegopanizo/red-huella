import { fileURLToPath } from 'node:url'

import { count } from 'drizzle-orm'
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
