import type { RequestHandler } from 'express'

import {
  getClearSessionCookieOptions,
  getSessionCookieOptions,
  sessionCookieName,
} from '../auth/cookie.js'
import { readSessionCookie } from '../auth/read-session-cookie.js'
import { loginSchema, registerSchema } from '../auth/schemas.js'
import { env } from '../config/index.js'
import { ValidationError } from '../errors/app-error.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import type { GetCurrentUserService } from '../services/get-current-user.service.js'
import type { LoginService } from '../services/login.service.js'
import type { LogoutService } from '../services/logout.service.js'
import type { RegisterUserService } from '../services/register-user.service.js'

export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserService,
    private readonly loginUser: LoginService,
    private readonly logoutUser: LogoutService,
    private readonly getCurrentUser: GetCurrentUserService,
  ) {}

  register: RequestHandler = async (request, response, next) => {
    try {
      const parsed = registerSchema.safeParse(request.body)
      if (!parsed.success)
        throw new ValidationError('Datos de registro no válidos', parsed.error)
      const result = await this.registerUser.execute(parsed.data)
      response.cookie(
        sessionCookieName,
        result.token,
        getSessionCookieOptions(env.NODE_ENV, result.expiresAt),
      )
      response.status(201).json({ user: result.user })
    } catch (error: unknown) {
      next(error)
    }
  }

  login: RequestHandler = async (request, response, next) => {
    try {
      const parsed = loginSchema.safeParse(request.body)
      if (!parsed.success)
        throw new ValidationError('Datos de acceso no válidos', parsed.error)
      const result = await this.loginUser.execute(parsed.data)
      response.cookie(
        sessionCookieName,
        result.token,
        getSessionCookieOptions(env.NODE_ENV, result.expiresAt),
      )
      response.status(200).json({ user: result.user })
    } catch (error: unknown) {
      next(error)
    }
  }

  logout: RequestHandler = async (request, response, next) => {
    try {
      await this.logoutUser.execute(readSessionCookie(request.get('cookie')))
      response.clearCookie(
        sessionCookieName,
        getClearSessionCookieOptions(env.NODE_ENV),
      )
      response.status(204).send()
    } catch (error: unknown) {
      next(error)
    }
  }

  me: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const user = await this.getCurrentUser.execute(request.auth.userId)
      response.status(200).json({ user })
    } catch (error: unknown) {
      next(error)
    }
  }
}
