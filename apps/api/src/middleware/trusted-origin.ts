import type { RequestHandler } from 'express'

import { env } from '../config/index.js'
import { ForbiddenError } from '../errors/auth-errors.js'

export const requireTrustedOrigin: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (request.get('origin') !== env.WEB_ORIGIN) {
    next(new ForbiddenError())
    return
  }
  next()
}
