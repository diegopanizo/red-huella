import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app.js'
import { HealthService } from './services/health.service.js'

function createTestApp(databaseCheck: () => Promise<void>) {
  return createApp({
    healthService: new HealthService({ check: databaseCheck }),
  })
}

describe('API infrastructure', () => {
  it('returns 200 when the database is ready', async () => {
    const response = await request(
      createTestApp(vi.fn().mockResolvedValue(undefined)),
    ).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', database: 'ok' })
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin')
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('returns 503 when the database is unavailable', async () => {
    const response = await request(
      createTestApp(vi.fn().mockRejectedValue(new Error('connection refused'))),
    ).get('/api/v1/health')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'error', database: 'unavailable' })
  })

  it('returns the sanitized error contract for unknown routes', async () => {
    const response = await request(createTestApp(vi.fn())).get(
      '/api/v1/non-existing',
    )

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: {
        code: 'APP_NOT_FOUND',
        message: 'Recurso no encontrado',
        requestId: response.headers['x-request-id'],
      },
    })
    expect(response.body).not.toHaveProperty('stack')
  })
})
