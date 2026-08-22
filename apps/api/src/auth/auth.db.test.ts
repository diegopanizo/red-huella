import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.js'
import { env } from '../config/index.js'
import { DrizzleAuthRegistrationRepository } from '../repositories/drizzle-auth-registration.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { createAuthRouter } from '../routes/auth.routes.js'
import { assertSafeTestDatabaseUrl } from '../database/test-database.js'
import * as schema from '../database/schema/index.js'

const pool = new Pool({
  connectionString: assertSafeTestDatabaseUrl(env),
  max: 2,
})
const database = drizzle({ client: pool, schema })
const users = new DrizzleUserRepository(database)
const sessions = new DrizzleSessionRepository(database)
const registrations = new DrizzleAuthRegistrationRepository(database)
const app = createApp({
  authRouter: createAuthRouter({
    users,
    sessions,
    registrations,
    rateLimits: { loginMax: 2, registerMax: 20 },
  }),
})

beforeAll(async () => {
  await migrate(database, {
    migrationsFolder: fileURLToPath(
      new URL('../database/migrations', import.meta.url),
    ),
  })
})

beforeEach(async () => {
  await database.delete(schema.sessions)
  await database.delete(schema.publicationImages)
  await database.delete(schema.publications)
  await database.delete(schema.animals)
  await database.delete(schema.users)
})

afterAll(async () => pool.end())

describe('authentication HTTP flow with PostgreSQL', () => {
  it('registers, authenticates through HttpOnly cookie, logs out and revokes the session', async () => {
    const agent = request.agent(app)
    const registration = await agent
      .post('/api/v1/auth/register')
      .set('Origin', env.WEB_ORIGIN)
      .send({
        name: 'Diego',
        email: 'DIEGO@example.test',
        password: 'a secure passphrase',
        role: 'USER',
      })

    expect(registration.status).toBe(400)

    const accepted = await agent
      .post('/api/v1/auth/register')
      .set('Origin', env.WEB_ORIGIN)
      .send({
        name: 'Diego',
        email: 'DIEGO@example.test',
        password: 'a secure passphrase',
      })
    expect(accepted.status).toBe(201)
    expect(accepted.body.user).toMatchObject({
      name: 'Diego',
      email: 'diego@example.test',
      role: 'USER',
    })
    expect(accepted.body.user).not.toHaveProperty('passwordHash')
    const setCookie = accepted.headers['set-cookie'] as unknown as string[]
    expect(setCookie[0]).toContain('Path=/api/v1')
    expect(setCookie[0]).toContain('HttpOnly')
    expect(setCookie[0]).toContain('SameSite=Strict')
    expect(setCookie[0]).toContain('Max-Age=')
    expect(setCookie[0]).not.toContain('Secure')

    expect((await agent.get('/api/v1/auth/me')).status).toBe(200)
    const logout = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', env.WEB_ORIGIN)
    expect(logout.status).toBe(204)
    expect((logout.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    )
    expect((logout.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'Path=/api/v1',
    )
    expect((logout.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'HttpOnly',
    )
    expect((logout.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'SameSite=Strict',
    )
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401)
    expect(
      (await agent.post('/api/v1/auth/logout').set('Origin', env.WEB_ORIGIN))
        .status,
    ).toBe(204)

    const login = await agent
      .post('/api/v1/auth/login')
      .set('Origin', env.WEB_ORIGIN)
      .send({
        email: 'diego@example.test',
        password: 'a secure passphrase',
      })
    expect(login.status).toBe(200)
    const loginCookie = login.headers['set-cookie'] as unknown as string[]
    expect(loginCookie[0]).toContain('Path=/api/v1')
    expect(loginCookie[0]).toContain('HttpOnly')
    expect(loginCookie[0]).toContain('SameSite=Strict')
    expect(loginCookie[0]).not.toContain('Secure')
  })

  it('maps duplicate email, rejects untrusted origins, generic bad credentials and rate limits login', async () => {
    const payload = {
      name: 'User',
      email: 'unique@example.test',
      password: 'a secure passphrase',
    }
    expect(
      (
        await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', env.WEB_ORIGIN)
          .send(payload)
      ).status,
    ).toBe(201)
    expect(
      (
        await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', env.WEB_ORIGIN)
          .send(payload)
      ).status,
    ).toBe(409)
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', 'https://evil.example')
          .send({ email: payload.email, password: payload.password })
      ).status,
    ).toBe(403)

    const bad = {
      email: 'missing@example.test',
      password: 'wrong password value',
    }
    const first = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', env.WEB_ORIGIN)
      .send(bad)
    expect(first.status).toBe(401)
    expect(first.body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
    await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', env.WEB_ORIGIN)
      .send(bad)
    const limited = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', env.WEB_ORIGIN)
      .send(bad)
    expect(limited.status).toBe(429)
    expect(limited.body.error.requestId).toBeTypeOf('string')
  })
})
