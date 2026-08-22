import type { RequestHandler } from 'express'

import { readSessionCookie } from '../auth/read-session-cookie.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import type { SessionAuthenticationService } from '../services/session-authentication.service.js'

export function optionalAuth(
  service: SessionAuthenticationService,
): RequestHandler {
  return async (request, _response, next) => {
    const token = readSessionCookie(request.get('cookie'))
    if (!token) {
      next()
      return
    }
    try {
      request.auth = await service.authenticate(token)
      next()
    } catch (error: unknown) {
      if (error instanceof UnauthenticatedError) {
        next()
        return
      }
      next(error)
    }
  }
}
