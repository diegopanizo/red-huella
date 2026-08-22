import type { RequestHandler } from 'express'

import { logger } from '../logging/logger.js'

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now()
  const method = request.method
  const path = request.path

  response.on('finish', () => {
    if (path === '/api/v1/health' && response.statusCode < 500) return

    logger.info(
      {
        requestId: request.requestId,
        method,
        path,
        statusCode: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      },
      'request completed',
    )
  })

  next()
}
