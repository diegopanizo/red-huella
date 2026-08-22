import type { Request, Response } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

export interface ContactRateLimitOverrides {
  userMax?: number
  ipMax?: number
  windowMs?: number
}

export function createContactRateLimiters(
  overrides: ContactRateLimitOverrides = {},
) {
  const common = {
    windowMs: overrides.windowMs ?? 15 * 60 * 1000,
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    handler: (request: Request, response: Response) => {
      response.status(429).json({
        error: {
          code: 'CONTACT_RATE_LIMITED',
          message: 'Demasiadas consultas de contacto',
          requestId: request.requestId,
        },
      })
    },
  }
  return {
    byUser: rateLimit({
      ...common,
      limit: overrides.userMax ?? 30,
      keyGenerator: (request) => request.auth?.userId ?? 'unauthenticated',
    }),
    byIp: rateLimit({
      ...common,
      limit: overrides.ipMax ?? 100,
      keyGenerator: (request) => ipKeyGenerator(request.ip ?? ''),
    }),
  }
}
