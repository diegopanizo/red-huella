import { rateLimit } from 'express-rate-limit'
import type { Request, Response } from 'express'

import type { Environment } from '../config/index.js'

export interface AuthRateLimitOverrides {
  loginMax?: number
  registerMax?: number
}

export function createAuthRateLimiters(
  nodeEnvironment: Environment['NODE_ENV'],
  overrides: AuthRateLimitOverrides = {},
) {
  const development = nodeEnvironment !== 'production'
  const common = {
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    handler: (request: Request, response: Response) => {
      response.status(429).json({
        error: {
          code: 'AUTH_RATE_LIMITED',
          message: 'Demasiados intentos',
          requestId: request.requestId,
        },
      })
    },
  }

  return {
    login: rateLimit({
      ...common,
      windowMs: 15 * 60 * 1000,
      limit: overrides.loginMax ?? (development ? 100 : 8),
    }),
    register: rateLimit({
      ...common,
      windowMs: 60 * 60 * 1000,
      limit: overrides.registerMax ?? (development ? 100 : 5),
    }),
  }
}
