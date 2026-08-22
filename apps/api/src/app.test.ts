import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from './app.js'

describe('GET /api/v1/health', () => {
  it('confirma que la API está disponible sin abrir un puerto', async () => {
    const response = await request(createApp()).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
