import type { RequestHandler } from 'express'

import { readSessionCookie } from '../auth/read-session-cookie.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import type { SessionAuthenticationService } from '../services/session-authentication.service.js'

export function requireAuth(
  service: SessionAuthenticationService,
): RequestHandler {
  return async (request, _response, next) => {
    try {
      const token = readSessionCookie(request.get('cookie'))
      if (!token) throw new UnauthenticatedError()
      request.auth = await service.authenticate(token)
      next()
    } catch (error: unknown) {
      next(error)
    }
  }
}
