import { describe, expect, it, vi } from 'vitest'

import { DatabaseError } from '../errors/app-error.js'
import { HealthService } from './health.service.js'

describe('HealthService', () => {
  it('informa disponibilidad cuando PostgreSQL responde', async () => {
    const probe = { check: vi.fn().mockResolvedValue(undefined) }
    await expect(new HealthService(probe).check()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    })
  })

  it('informa indisponibilidad sin filtrar el error de PostgreSQL', async () => {
    const probe = {
      check: vi
        .fn()
        .mockRejectedValue(new DatabaseError(new Error('connection refused'))),
    }
    await expect(new HealthService(probe).check()).resolves.toEqual({
      status: 'error',
      database: 'unavailable',
    })
  })
})
