import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createContactRateLimiters } from './contact-rate-limit.js'

function testApp(userMax: number, ipMax: number) {
  const app = express()
  const limits = createContactRateLimiters({ userMax, ipMax })
  app.get(
    '/contact',
    (request, _response, next) => {
      const userId = request.get('x-test-user')
      if (!userId) throw new Error('test user required')
      request.auth = { userId, role: 'USER', sessionId: `session-${userId}` }
      next()
    },
    limits.byUser,
    limits.byIp,
    (_request, response) => response.json({ ok: true }),
  )
  return app
}

describe('contact rate limiting', () => {
  it('allows requests below the user limit and isolates user buckets', async () => {
    const app = testApp(2, 20)
    expect(
      (await request(app).get('/contact').set('x-test-user', 'user-a')).status,
    ).toBe(200)
    expect(
      (await request(app).get('/contact').set('x-test-user', 'user-a')).status,
    ).toBe(200)
    const limited = await request(app)
      .get('/contact')
      .set('x-test-user', 'user-a')
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('CONTACT_RATE_LIMITED')
    expect(
      (await request(app).get('/contact').set('x-test-user', 'user-b')).status,
    ).toBe(200)
  })

  it('applies the additional IP bucket across different users', async () => {
    const app = testApp(10, 2)
    expect(
      (await request(app).get('/contact').set('x-test-user', 'user-a')).status,
    ).toBe(200)
    expect(
      (await request(app).get('/contact').set('x-test-user', 'user-b')).status,
    ).toBe(200)
    const limited = await request(app)
      .get('/contact')
      .set('x-test-user', 'user-c')
    expect(limited.status).toBe(429)
    expect(limited.body.error).toEqual({
      code: 'CONTACT_RATE_LIMITED',
      message: 'Demasiadas consultas de contacto',
    })
  })
})
