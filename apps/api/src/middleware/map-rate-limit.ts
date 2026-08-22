import type { Request, Response } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

export function createMapRateLimit(
  overrides: { max?: number; windowMs?: number } = {},
) {
  return rateLimit({
    windowMs: overrides.windowMs ?? 60_000,
    limit: overrides.max ?? 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (request) => ipKeyGenerator(request.ip ?? ''),
    handler: (request: Request, response: Response) => {
      response.status(429).json({
        error: {
          code: 'MAP_RATE_LIMITED',
          message: 'Demasiadas consultas del mapa',
          requestId: request.requestId,
        },
      })
    },
  })
}
