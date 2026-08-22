import { Router } from 'express'

import type { HealthService } from '../services/health.service.js'

export function createHealthRouter(healthService: HealthService): Router {
  const router = Router()

  router.get('/', async (_request, response, next) => {
    try {
      const health = await healthService.check()
      response.status(health.status === 'ok' ? 200 : 503).json(health)
    } catch (error: unknown) {
      next(error)
    }
  })

  return router
}
