import type { RequestHandler } from 'express'

import type { UserRole } from '../database/schema/enums.js'
import { ForbiddenError, UnauthenticatedError } from '../errors/auth-errors.js'

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new UnauthenticatedError())
      return
    }
    if (!allowedRoles.includes(request.auth.role)) {
      next(new ForbiddenError())
      return
    }
    next()
  }
}
