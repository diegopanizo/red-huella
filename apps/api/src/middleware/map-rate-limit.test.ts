import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { requestId } from './request-id.js'
import { createMapRateLimit } from './map-rate-limit.js'

describe('map rate limiter', () => {
  it('returns a stable error after the per-IP limit', async () => {
    const app = express()
    app.use(requestId)
    app.get('/map', createMapRateLimit({ max: 1 }), (_request, response) =>
      response.json({ ok: true }),
    )

    expect((await request(app).get('/map')).status).toBe(200)
    const limited = await request(app).get('/map')
    expect(limited.status).toBe(429)
    expect(limited.body.error).toMatchObject({ code: 'MAP_RATE_LIMITED' })
    expect(limited.body.error.requestId).toEqual(expect.any(String))
  })
})
