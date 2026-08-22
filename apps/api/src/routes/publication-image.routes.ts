import { Router } from 'express'

import { PublicationImageContentController } from '../controllers/image.controller.js'
import { env } from '../config/index.js'
import { db } from '../database/client.js'
import { LocalImageStorage } from '../images/local-image-storage.js'
import type { ImageStorage } from '../images/image-storage.js'
import { optionalAuth } from '../middleware/optional-auth.js'
import type { ImageRepository } from '../repositories/contracts/image.repository.js'
import type { SessionRepository } from '../repositories/contracts/session.repository.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'
import { DrizzleImageRepository } from '../repositories/drizzle-image.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { GetPublicationImageContentService } from '../services/image.services.js'
import { SessionAuthenticationService } from '../services/session-authentication.service.js'

export interface PublicationImageContentModuleDependencies {
  images?: ImageRepository
  storage?: ImageStorage
  sessions?: SessionRepository
  users?: UserRepository
}

export function createPublicationImageContentRouter(
  dependencies: PublicationImageContentModuleDependencies = {},
) {
  const images = dependencies.images ?? new DrizzleImageRepository(db)
  const storage =
    dependencies.storage ?? new LocalImageStorage(env.IMAGE_STORAGE_LOCAL_ROOT)
  const sessions = dependencies.sessions ?? new DrizzleSessionRepository(db)
  const users = dependencies.users ?? new DrizzleUserRepository(db)
  const auth = optionalAuth(new SessionAuthenticationService(sessions, users))
  const controller = new PublicationImageContentController(
    new GetPublicationImageContentService(images, storage),
  )
  const router = Router()
  router.get('/:imageId/content', auth, controller.display)
  router.get('/:imageId/thumbnail', auth, controller.thumbnail)
  return router
}
