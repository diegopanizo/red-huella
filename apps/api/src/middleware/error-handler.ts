import type { ErrorRequestHandler } from 'express'

import { mapToAppError } from '../errors/app-error.js'
import { logger } from '../logging/logger.js'

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  _next,
) => {
  // Express identifies error middleware by its four-argument signature.
  void _next
  const appError = mapToAppError(error)
  const logContext = {
    requestId: request.requestId,
    method: request.method,
    path: request.path,
    statusCode: appError.statusCode,
    code: appError.code,
  }

  if (appError.operational) {
    logger.warn(logContext, 'operational request error')
  } else {
    logger.error({ ...logContext, err: error }, 'unexpected request error')
  }

  response.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      requestId: request.requestId,
    },
  })
}
