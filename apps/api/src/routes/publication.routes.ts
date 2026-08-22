import { Router } from 'express'

import { PublicationController } from '../controllers/publication.controller.js'
import { db } from '../database/client.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requireTrustedOrigin } from '../middleware/trusted-origin.js'
import type { SessionRepository } from '../repositories/contracts/session.repository.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'
import type { PublicationRepository } from '../repositories/contracts/publication.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { SessionAuthenticationService } from '../services/session-authentication.service.js'
import {
  ChangePublicationStatusService,
  CreatePublicationService,
  GetPublicationService,
  ListPublicationsService,
  UpdatePublicationService,
} from '../services/publication.services.js'

export interface PublicationModuleDependencies {
  publications?: PublicationRepository
  sessions?: SessionRepository
  users?: UserRepository
}

export function createPublicationRouter(
  dependencies: PublicationModuleDependencies = {},
) {
  const publications =
    dependencies.publications ?? new DrizzlePublicationRepository(db)
  const sessions = dependencies.sessions ?? new DrizzleSessionRepository(db)
  const users = dependencies.users ?? new DrizzleUserRepository(db)
  const auth = requireAuth(new SessionAuthenticationService(sessions, users))
  const controller = new PublicationController(
    new CreatePublicationService(publications),
    new GetPublicationService(publications),
    new ListPublicationsService(publications),
    new UpdatePublicationService(publications),
    new ChangePublicationStatusService(publications),
  )
  const router = Router()
  router.get('/', controller.list)
  router.get('/mine', auth, controller.mine)
  router.get('/:id', controller.get)
  router.post('/', requireTrustedOrigin, auth, controller.create)
  router.patch('/:id', requireTrustedOrigin, auth, controller.update)
  router.patch('/:id/status', requireTrustedOrigin, auth, controller.status)
  return router
}
