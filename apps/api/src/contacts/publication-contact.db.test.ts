import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { env } from '../config/index.js'
import { createApp } from '../app.js'
import { createSessionToken } from '../auth/session-token.js'
import * as schema from '../database/schema/index.js'
import { assertSafeTestDatabaseUrl } from '../database/test-database.js'
import { DrizzleAnimalRepository } from '../repositories/drizzle-animal.repository.js'
import { DrizzlePublicationContactRepository } from '../repositories/drizzle-publication-contact.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { createPublicationRouter } from '../routes/publication.routes.js'

const pool = new Pool({
  connectionString: assertSafeTestDatabaseUrl(env),
  max: 2,
})
const database = drizzle({ client: pool, schema })
const users = new DrizzleUserRepository(database)
const animals = new DrizzleAnimalRepository(database)
const publications = new DrizzlePublicationRepository(database)
const contacts = new DrizzlePublicationContactRepository(database)
const sessions = new DrizzleSessionRepository(database)
const app = createApp({
  publicationRouter: createPublicationRouter({
    publications,
    contacts,
    sessions,
    users,
  }),
})

async function createPublication() {
  const user = await users.create({
    name: 'Contact Test Owner',
    email: `${randomUUID()}@example.test`,
  })
  const animal = await animals.create({ species: 'DOG' })
  const publication = await publications.create({
    userId: user.id,
    animalId: animal.id,
    type: 'LOST',
    title: 'Synthetic contact test publication',
    eventDate: new Date('2026-08-01T00:00:00Z'),
  })
  const session = createSessionToken()
  await sessions.create({
    userId: user.id,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
  })
  return {
    user,
    animal,
    publication,
    cookie: `red_huella_session=${session.token}`,
  }
}

function getSettings(publicationId: string, cookie?: string) {
  const operation = request(app).get(
    `/api/v1/publications/${publicationId}/contact-settings`,
  )
  return cookie ? operation.set('Cookie', cookie) : operation
}

function getContact(publicationId: string, cookie?: string) {
  const operation = request(app).get(
    `/api/v1/publications/${publicationId}/contact`,
  )
  return cookie ? operation.set('Cookie', cookie) : operation
}

function putSettings(
  publicationId: string,
  body: object,
  cookie?: string,
  origin = env.WEB_ORIGIN,
) {
  let operation = request(app)
    .put(`/api/v1/publications/${publicationId}/contact-settings`)
    .set('Origin', origin)
  if (cookie) operation = operation.set('Cookie', cookie)
  return operation.send(body)
}

beforeAll(async () => {
  await migrate(database, {
    migrationsFolder: fileURLToPath(
      new URL('../database/migrations', import.meta.url),
    ),
  })
})

beforeEach(async () => {
  await database.delete(schema.publicationContactMethods)
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

describe('publication contact persistence', () => {
  it('applies the enum and table migration', async () => {
    const enumValues = await pool.query<{ enumlabel: string }>(`
      select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'publication_contact_method'
      order by e.enumsortorder
    `)
    expect(enumValues.rows.map((row) => row.enumlabel)).toEqual([
      'WHATSAPP',
      'PHONE',
      'EMAIL',
    ])

    const table = await pool.query<{ table_name: string }>(`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name = 'publication_contact_methods'
    `)
    expect(table.rows).toEqual([{ table_name: 'publication_contact_methods' }])
  })

  it('replaces atomically and returns WHATSAPP, PHONE, EMAIL order', async () => {
    const { publication } = await createPublication()
    const result = await contacts.replaceAll({
      publicationId: publication.id,
      methods: [
        { type: 'EMAIL', value: '  OWNER@EXAMPLE.COM  ' },
        { type: 'PHONE', value: '+34911111222' },
        { type: 'WHATSAPP', value: '+34600111222' },
      ],
    })
    expect(result.map(({ method, value }) => ({ method, value }))).toEqual([
      { method: 'WHATSAPP', value: '+34600111222' },
      { method: 'PHONE', value: '+34911111222' },
      { method: 'EMAIL', value: 'owner@example.com' },
    ])
    await expect(contacts.findByPublicationId(publication.id)).resolves.toEqual(
      result,
    )
  })

  it('replaceAll([]) physically removes all methods', async () => {
    const { publication } = await createPublication()
    await contacts.replaceAll({
      publicationId: publication.id,
      methods: [{ type: 'PHONE', value: '+34911111222' }],
    })
    await expect(
      contacts.replaceAll({ publicationId: publication.id, methods: [] }),
    ).resolves.toEqual([])
    await expect(contacts.findByPublicationId(publication.id)).resolves.toEqual(
      [],
    )
  })

  it('preserves the previous collection when replacement validation fails', async () => {
    const { publication } = await createPublication()
    const previous = await contacts.replaceAll({
      publicationId: publication.id,
      methods: [{ type: 'PHONE', value: '+34911111222' }],
    })
    expect(() =>
      contacts.replaceAll({
        publicationId: publication.id,
        methods: [{ type: 'PHONE', value: 'not-e164' }],
      }),
    ).toThrow()
    await expect(contacts.findByPublicationId(publication.id)).resolves.toEqual(
      previous,
    )
  })

  it('enforces FK, uniqueness, trim, non-empty, E.164 and email length', async () => {
    const { publication } = await createPublication()
    const insert = (publicationId: string, method: string, value: string) =>
      pool.query(
        `insert into publication_contact_methods (publication_id, method, value)
         values ($1, $2, $3)`,
        [publicationId, method, value],
      )

    await expect(
      insert(randomUUID(), 'PHONE', '+34911111222'),
    ).rejects.toThrow()
    await insert(publication.id, 'PHONE', '+34911111222')
    await expect(
      insert(publication.id, 'PHONE', '+34922222333'),
    ).rejects.toThrow()
    await expect(
      insert(publication.id, 'EMAIL', ' contact@example.com'),
    ).rejects.toThrow()
    await expect(insert(publication.id, 'EMAIL', '')).rejects.toThrow()
    await expect(
      insert(publication.id, 'WHATSAPP', '34600111222'),
    ).rejects.toThrow()
    await expect(
      insert(publication.id, 'EMAIL', `${'a'.repeat(251)}@x.t`),
    ).rejects.toThrow()
  })

  it('cascades on publication deletion and never copies the login email', async () => {
    const { user, publication } = await createPublication()
    await expect(contacts.findByPublicationId(publication.id)).resolves.toEqual(
      [],
    )
    expect(user.email).not.toBe('contact@example.com')

    await contacts.replaceAll({
      publicationId: publication.id,
      methods: [{ type: 'EMAIL', value: 'contact@example.com' }],
    })
    await database
      .delete(schema.publications)
      .where(eq(schema.publications.id, publication.id))
    await expect(contacts.findByPublicationId(publication.id)).resolves.toEqual(
      [],
    )
  })

  it('serializes status change and owner replacement through the publication lock', async () => {
    const owner = await createPublication()
    const [replacement] = await Promise.all([
      contacts.replaceAllForOwner({
        publicationId: owner.publication.id,
        ownerId: owner.user.id,
        methods: [{ type: 'PHONE', value: '+34911111222' }],
        mutableStatuses: ['ACTIVE'],
      }),
      database
        .update(schema.publications)
        .set({ status: 'RESOLVED' })
        .where(eq(schema.publications.id, owner.publication.id)),
    ])
    expect(['replaced', 'status_not_allowed']).toContain(replacement.outcome)
    expect((await publications.findById(owner.publication.id))?.status).toBe(
      'RESOLVED',
    )
    const persisted = await contacts.findByPublicationId(owner.publication.id)
    expect(persisted).toHaveLength(replacement.outcome === 'replaced' ? 1 : 0)
  })
})

describe('owner contact settings HTTP API', () => {
  it('returns an empty allowlisted, non-cacheable owner response without ETag', async () => {
    const owner = await createPublication()
    const response = await getSettings(owner.publication.id, owner.cookie)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ contactSettings: { methods: [] } })
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers.pragma).toBe('no-cache')
    expect(response.headers).not.toHaveProperty('etag')
  })

  it('returns only configured type and value in deterministic order', async () => {
    const owner = await createPublication()
    await contacts.replaceAll({
      publicationId: owner.publication.id,
      methods: [
        { type: 'EMAIL', value: 'contact@example.com' },
        { type: 'WHATSAPP', value: '+34600111222' },
      ],
    })
    const response = await getSettings(owner.publication.id, owner.cookie)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      contactSettings: {
        methods: [
          { type: 'WHATSAPP', value: '+34600111222' },
          { type: 'EMAIL', value: 'contact@example.com' },
        ],
      },
    })
    expect(JSON.stringify(response.body)).not.toMatch(
      /createdAt|updatedAt|publicationId|userId|Contact Test Owner/i,
    )
  })

  it.each(['ACTIVE', 'RESOLVED', 'ADOPTED', 'ARCHIVED'] as const)(
    'allows owner GET in %s',
    async (status) => {
      const owner = await createPublication()
      await database
        .update(schema.publications)
        .set({ status })
        .where(eq(schema.publications.id, owner.publication.id))
      expect(
        (await getSettings(owner.publication.id, owner.cookie)).status,
      ).toBe(200)
    },
  )

  it('enforces authentication, existence and ownership on GET', async () => {
    const owner = await createPublication()
    const other = await createPublication()
    expect((await getSettings(owner.publication.id)).status).toBe(401)
    const forbidden = await getSettings(owner.publication.id, other.cookie)
    expect(forbidden.status).toBe(403)
    expect(forbidden.body.error.code).toBe('PUBLICATION_FORBIDDEN')
    expect((await getSettings(randomUUID(), owner.cookie)).status).toBe(404)
  })

  it.each([
    { methods: [{ type: 'PHONE', value: '+34911111222' }] },
    { methods: [{ type: 'WHATSAPP', value: '+34600111222' }] },
    { methods: [{ type: 'EMAIL', value: '  CONTACTO@EXAMPLE.COM  ' }] },
    {
      methods: [
        { type: 'WHATSAPP', value: '+34600111222' },
        { type: 'PHONE', value: '+34911111222' },
        { type: 'EMAIL', value: 'contacto@example.com' },
      ],
    },
  ])('configures an ACTIVE publication: $methods', async ({ methods }) => {
    const owner = await createPublication()
    const response = await putSettings(
      owner.publication.id,
      { methods },
      owner.cookie,
    )
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers.pragma).toBe('no-cache')
    expect(response.headers).not.toHaveProperty('etag')
    const values = response.body.contactSettings.methods as Array<{
      type: string
      value: string
    }>
    if (methods.some((method) => method.type === 'EMAIL'))
      expect(values.find((method) => method.type === 'EMAIL')?.value).toBe(
        'contacto@example.com',
      )
  })

  it('replaces the full ACTIVE collection and [] removes it', async () => {
    const owner = await createPublication()
    await putSettings(
      owner.publication.id,
      {
        methods: [
          { type: 'PHONE', value: '+34911111222' },
          { type: 'EMAIL', value: 'contact@example.com' },
        ],
      },
      owner.cookie,
    )
    const replaced = await putSettings(
      owner.publication.id,
      { methods: [{ type: 'WHATSAPP', value: '+34600111222' }] },
      owner.cookie,
    )
    expect(replaced.body.contactSettings.methods).toEqual([
      { type: 'WHATSAPP', value: '+34600111222' },
    ])
    const removed = await putSettings(
      owner.publication.id,
      { methods: [] },
      owner.cookie,
    )
    expect(removed.body).toEqual({ contactSettings: { methods: [] } })
  })

  it.each([
    {
      methods: [
        { type: 'PHONE', value: '+34911111222' },
        { type: 'PHONE', value: '+34922222333' },
      ],
    },
    { methods: [{ type: 'PHONE', value: '911111222' }] },
    { methods: [{ type: 'EMAIL', value: 'invalid-email' }] },
    {
      methods: [{ type: 'PHONE', value: '+34911111222', unexpected: true }],
    },
    { methods: [], unexpected: true },
  ])('rejects invalid strict payload %j', async (body) => {
    const owner = await createPublication()
    expect(
      (await putSettings(owner.publication.id, body, owner.cookie)).status,
    ).toBe(400)
  })

  it('enforces Origin, authentication and ownership on PUT', async () => {
    const owner = await createPublication()
    const other = await createPublication()
    const body = { methods: [{ type: 'PHONE', value: '+34911111222' }] }
    expect(
      (
        await request(app)
          .put(`/api/v1/publications/${owner.publication.id}/contact-settings`)
          .set('Cookie', owner.cookie)
          .send(body)
      ).status,
    ).toBe(403)
    expect(
      (await putSettings(owner.publication.id, body, owner.cookie, 'null'))
        .status,
    ).toBe(403)
    expect((await putSettings(owner.publication.id, body)).status).toBe(401)
    expect(
      (await putSettings(owner.publication.id, body, other.cookie)).status,
    ).toBe(403)
  })

  it.each(['RESOLVED', 'ADOPTED', 'ARCHIVED'] as const)(
    'allows only exact retention or removal in %s',
    async (status) => {
      const owner = await createPublication()
      const original = [
        { type: 'PHONE' as const, value: '+34911111222' },
        { type: 'EMAIL' as const, value: 'contact@example.com' },
      ]
      await contacts.replaceAll({
        publicationId: owner.publication.id,
        methods: original,
      })
      await database
        .update(schema.publications)
        .set({ status })
        .where(eq(schema.publications.id, owner.publication.id))

      expect(
        (
          await putSettings(
            owner.publication.id,
            { methods: original },
            owner.cookie,
          )
        ).status,
      ).toBe(200)
      expect(
        (
          await putSettings(
            owner.publication.id,
            { methods: [original[0]] },
            owner.cookie,
          )
        ).status,
      ).toBe(200)

      for (const methods of [
        [{ type: 'PHONE', value: '+34922222333' }],
        [
          { type: 'PHONE', value: '+34911111222' },
          { type: 'WHATSAPP', value: '+34600111222' },
        ],
        [{ type: 'EMAIL', value: 'other@example.com' }],
      ]) {
        const rejected = await putSettings(
          owner.publication.id,
          { methods },
          owner.cookie,
        )
        expect(rejected.status).toBe(409)
        expect(rejected.body.error.code).toBe(
          'CONTACT_SETTINGS_READ_ONLY_FOR_STATUS',
        )
      }
      expect(
        (await putSettings(owner.publication.id, { methods: [] }, owner.cookie))
          .status,
      ).toBe(200)
      expect(
        (
          await putSettings(
            owner.publication.id,
            { methods: [{ type: 'PHONE', value: '+34911111222' }] },
            owner.cookie,
          )
        ).status,
      ).toBe(409)
    },
  )

  it('keeps all publication responses free of contact PII', async () => {
    const owner = await createPublication()
    const contactValue = 'private-contact@example.com'
    await contacts.replaceAll({
      publicationId: owner.publication.id,
      methods: [{ type: 'EMAIL', value: contactValue }],
    })
    const responses = await Promise.all([
      request(app).get('/api/v1/publications'),
      request(app).get(`/api/v1/publications/${owner.publication.id}`),
      request(app).get('/api/v1/publications/mine').set('Cookie', owner.cookie),
      request(app)
        .get(`/api/v1/publications/${owner.publication.id}/manage`)
        .set('Cookie', owner.cookie),
    ])
    for (const response of responses) {
      expect(response.status).toBe(200)
      const serialized = JSON.stringify(response.body)
      expect(serialized).not.toContain(contactValue)
      expect(serialized).not.toMatch(/contactSettings|contact_method/i)
    }
  })
})

describe('authenticated publication contact HTTP API', () => {
  it.each([
    { type: 'PHONE' as const, value: '+34911111222' },
    { type: 'WHATSAPP' as const, value: '+34600111222' },
    { type: 'EMAIL' as const, value: 'contact@example.com' },
  ])(
    'returns an enabled $type method to an active requester',
    async (method) => {
      const owner = await createPublication()
      const requester = await createPublication()
      await contacts.replaceAll({
        publicationId: owner.publication.id,
        methods: [method],
      })
      const response = await getContact(owner.publication.id, requester.cookie)
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ contact: { methods: [method] } })
    },
  )

  it('allows the active owner and returns deterministic, minimal data', async () => {
    const owner = await createPublication()
    await contacts.replaceAll({
      publicationId: owner.publication.id,
      methods: [
        { type: 'EMAIL', value: 'contact@example.com' },
        { type: 'PHONE', value: '+34911111222' },
        { type: 'WHATSAPP', value: '+34600111222' },
      ],
    })
    const response = await getContact(owner.publication.id, owner.cookie)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      contact: {
        methods: [
          { type: 'WHATSAPP', value: '+34600111222' },
          { type: 'PHONE', value: '+34911111222' },
          { type: 'EMAIL', value: 'contact@example.com' },
        ],
      },
    })
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers.pragma).toBe('no-cache')
    expect(response.headers).not.toHaveProperty('etag')
    expect(JSON.stringify(response.body)).not.toMatch(
      /publicationId|userId|createdAt|updatedAt|exactLocation|publicLocation|description|status/i,
    )
    expect(JSON.stringify(response.body)).not.toContain(owner.user.email)
  })

  it('rejects anonymous and blocked requesters through existing authentication', async () => {
    const owner = await createPublication()
    const requester = await createPublication()
    await contacts.replaceAll({
      publicationId: owner.publication.id,
      methods: [{ type: 'PHONE', value: '+34911111222' }],
    })
    expect((await getContact(owner.publication.id)).status).toBe(401)
    await database
      .update(schema.users)
      .set({ status: 'BLOCKED' })
      .where(eq(schema.users.id, requester.user.id))
    expect(
      (await getContact(owner.publication.id, requester.cookie)).status,
    ).toBe(401)
  })

  it.each(['RESOLVED', 'ADOPTED', 'ARCHIVED'] as const)(
    'returns unified 404 for a %s publication, including its owner',
    async (status) => {
      const owner = await createPublication()
      await contacts.replaceAll({
        publicationId: owner.publication.id,
        methods: [{ type: 'PHONE', value: '+34911111222' }],
      })
      await database
        .update(schema.publications)
        .set({ status })
        .where(eq(schema.publications.id, owner.publication.id))
      const response = await getContact(owner.publication.id, owner.cookie)
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('CONTACT_NOT_AVAILABLE')
    },
  )

  it('unifies nonexistent, blocked-author and no-method responses', async () => {
    const owner = await createPublication()
    const requester = await createPublication()
    const unavailable = async (publicationId: string) => {
      const response = await getContact(publicationId, requester.cookie)
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('CONTACT_NOT_AVAILABLE')
      expect(response.body.error.message).toBe('Contacto no disponible')
      expect(response.headers['cache-control']).toBe('private, no-store')
      expect(response.headers.pragma).toBe('no-cache')
      return response.body.error
    }

    const missing = await unavailable(randomUUID())
    const withoutMethods = await unavailable(owner.publication.id)
    await contacts.replaceAll({
      publicationId: owner.publication.id,
      methods: [{ type: 'PHONE', value: '+34911111222' }],
    })
    await database
      .update(schema.users)
      .set({ status: 'BLOCKED' })
      .where(eq(schema.users.id, owner.user.id))
    const blockedAuthor = await unavailable(owner.publication.id)
    expect(withoutMethods.code).toBe(missing.code)
    expect(blockedAuthor.code).toBe(missing.code)
  })

  it('keeps contact absent from every other publication endpoint', async () => {
    const owner = await createPublication()
    const contactValue = 'private-public-contact@example.com'
    await contacts.replaceAll({
      publicationId: owner.publication.id,
      methods: [{ type: 'EMAIL', value: contactValue }],
    })
    const responses = await Promise.all([
      request(app).get('/api/v1/publications'),
      request(app).get(`/api/v1/publications/${owner.publication.id}`),
      request(app).get('/api/v1/publications/mine').set('Cookie', owner.cookie),
      request(app)
        .get(`/api/v1/publications/${owner.publication.id}/manage`)
        .set('Cookie', owner.cookie),
    ])
    for (const response of responses) {
      expect(response.status).toBe(200)
      const serialized = JSON.stringify(response.body)
      expect(serialized).not.toContain(contactValue)
      expect(serialized).not.toMatch(/contactAvailable|contactSettings/i)
    }
  })

  it('limits one user to 30 requests without consuming another user bucket', async () => {
    const owner = await createPublication()
    const requester = await createPublication()
    const otherRequester = await createPublication()
    await contacts.replaceAll({
      publicationId: owner.publication.id,
      methods: [{ type: 'PHONE', value: '+34911111222' }],
    })
    for (let index = 0; index < 30; index += 1)
      expect(
        (await getContact(owner.publication.id, requester.cookie)).status,
      ).toBe(200)
    const limited = await getContact(owner.publication.id, requester.cookie)
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('CONTACT_RATE_LIMITED')
    expect(
      (await getContact(owner.publication.id, otherRequester.cookie)).status,
    ).toBe(200)
  })
})
