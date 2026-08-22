import type { Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'

import { env } from '../config/index.js'

export const imageUploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (request: Request, response: Response) => {
    response.status(429).json({
      error: {
        code: 'IMAGE_RATE_LIMITED',
        message: 'Demasiadas peticiones de imágenes',
        requestId: request.requestId,
      },
    })
  },
})
