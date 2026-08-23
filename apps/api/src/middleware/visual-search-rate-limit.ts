import type { Request, Response } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

export interface VisualSearchRateLimitOverrides {
  userMax?: number
  ipMax?: number
  windowMs?: number
}

export function createVisualSearchRateLimiters(
  overrides: VisualSearchRateLimitOverrides = {},
) {
  const common = {
    windowMs: overrides.windowMs ?? 15 * 60 * 1000,
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    handler: (request: Request, response: Response) =>
      response.status(429).json({
        error: {
          code: 'VISUAL_SEARCH_RATE_LIMITED',
          message: 'Demasiadas búsquedas visuales',
          requestId: request.requestId,
        },
      }),
  }
  return {
    byUser: rateLimit({
      ...common,
      limit: overrides.userMax ?? 10,
      keyGenerator: (request) => request.auth?.userId ?? 'unauthenticated',
    }),
    byIp: rateLimit({
      ...common,
      limit: overrides.ipMax ?? 30,
      keyGenerator: (request) => ipKeyGenerator(request.ip ?? ''),
    }),
  }
}
