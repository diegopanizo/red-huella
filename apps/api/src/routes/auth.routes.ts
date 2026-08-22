import { Router } from 'express'

import { Argon2PasswordHasher, type PasswordHasher } from '../auth/password.js'
import { env } from '../config/index.js'
import { AuthController } from '../controllers/auth.controller.js'
import { db } from '../database/client.js'
import {
  createAuthRateLimiters,
  type AuthRateLimitOverrides,
} from '../middleware/auth-rate-limit.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requireTrustedOrigin } from '../middleware/trusted-origin.js'
import type { AuthRegistrationRepository } from '../repositories/contracts/auth-registration.repository.js'
import type { SessionRepository } from '../repositories/contracts/session.repository.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'
import { DrizzleAuthRegistrationRepository } from '../repositories/drizzle-auth-registration.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { GetCurrentUserService } from '../services/get-current-user.service.js'
import { LoginService } from '../services/login.service.js'
import { LogoutService } from '../services/logout.service.js'
import { RegisterUserService } from '../services/register-user.service.js'
import { SessionAuthenticationService } from '../services/session-authentication.service.js'

export interface AuthModuleDependencies {
  users?: UserRepository
  sessions?: SessionRepository
  registrations?: AuthRegistrationRepository
  passwords?: PasswordHasher
  rateLimits?: AuthRateLimitOverrides
}

export function createAuthRouter(
  dependencies: AuthModuleDependencies = {},
): Router {
  const users = dependencies.users ?? new DrizzleUserRepository(db)
  const sessions = dependencies.sessions ?? new DrizzleSessionRepository(db)
  const registrations =
    dependencies.registrations ?? new DrizzleAuthRegistrationRepository(db)
  const passwords = dependencies.passwords ?? new Argon2PasswordHasher()
  const authSession = new SessionAuthenticationService(sessions, users)
  const controller = new AuthController(
    new RegisterUserService(users, registrations, passwords),
    new LoginService(users, sessions, passwords),
    new LogoutService(sessions),
    new GetCurrentUserService(users),
  )
  const limits = createAuthRateLimiters(env.NODE_ENV, dependencies.rateLimits)
  const router = Router()

  router.post(
    '/register',
    requireTrustedOrigin,
    limits.register,
    controller.register,
  )
  router.post('/login', requireTrustedOrigin, limits.login, controller.login)
  router.post('/logout', requireTrustedOrigin, controller.logout)
  router.get('/me', requireAuth(authSession), controller.me)

  return router
}
