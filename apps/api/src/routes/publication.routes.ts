import { Router } from 'express'

import { PublicationController } from '../controllers/publication.controller.js'
import { ContactSettingsController } from '../controllers/contact-settings.controller.js'
import { ContactController } from '../controllers/contact.controller.js'
import { PublicationImageController } from '../controllers/image.controller.js'
import { env } from '../config/index.js'
import { db } from '../database/client.js'
import type { ImageProcessor, ImageStorage } from '../images/image-storage.js'
import { LocalImageStorage } from '../images/local-image-storage.js'
import { SharpImageProcessor } from '../images/sharp-image-processor.js'
import { parseImageUpload } from '../middleware/image-upload.js'
import { imageUploadRateLimit } from '../middleware/image-upload-rate-limit.js'
import { createContactRateLimiters } from '../middleware/contact-rate-limit.js'
import { privateNoStore } from '../middleware/private-no-store.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requireTrustedOrigin } from '../middleware/trusted-origin.js'
import type { SessionRepository } from '../repositories/contracts/session.repository.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'
import type { PublicationRepository } from '../repositories/contracts/publication.repository.js'
import type { PublicationContactRepository } from '../repositories/contracts/publication-contact.repository.js'
import type { ImageRepository } from '../repositories/contracts/image.repository.js'
import { DrizzleImageRepository } from '../repositories/drizzle-image.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzlePublicationContactRepository } from '../repositories/drizzle-publication-contact.repository.js'
import { DrizzleSessionRepository } from '../repositories/drizzle-session.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { SessionAuthenticationService } from '../services/session-authentication.service.js'
import {
  ChangePublicationStatusService,
  CreatePublicationService,
  GetPublicationService,
  ListPublicationsService,
  ManagePublicationService,
  UpdatePublicationService,
} from '../services/publication.services.js'
import {
  GetPublicationContactSettingsService,
  ReplacePublicationContactSettingsService,
} from '../services/contact-settings.services.js'
import { GetPublicationContactService } from '../services/publication-contact.service.js'
import {
  DeletePublicationImageService,
  ProcessStorageDeletionJobsService,
  ReorderPublicationImagesService,
  UploadPublicationImagesService,
} from '../services/image.services.js'

export interface PublicationModuleDependencies {
  publications?: PublicationRepository
  sessions?: SessionRepository
  users?: UserRepository
  images?: ImageRepository
  imageProcessor?: ImageProcessor
  imageStorage?: ImageStorage
  contacts?: PublicationContactRepository
}

export function createPublicationRouter(
  dependencies: PublicationModuleDependencies = {},
) {
  const publications =
    dependencies.publications ?? new DrizzlePublicationRepository(db)
  const sessions = dependencies.sessions ?? new DrizzleSessionRepository(db)
  const users = dependencies.users ?? new DrizzleUserRepository(db)
  const images = dependencies.images ?? new DrizzleImageRepository(db)
  const contacts =
    dependencies.contacts ?? new DrizzlePublicationContactRepository(db)
  const imageProcessor =
    dependencies.imageProcessor ?? new SharpImageProcessor()
  const imageStorage =
    dependencies.imageStorage ??
    new LocalImageStorage(env.IMAGE_STORAGE_LOCAL_ROOT)
  const auth = requireAuth(new SessionAuthenticationService(sessions, users))
  const controller = new PublicationController(
    new CreatePublicationService(publications),
    new GetPublicationService(publications),
    new ListPublicationsService(publications),
    new ManagePublicationService(publications),
    new UpdatePublicationService(publications),
    new ChangePublicationStatusService(publications),
  )
  const deletionJobs = new ProcessStorageDeletionJobsService(
    images,
    imageStorage,
  )
  const contactSettingsController = new ContactSettingsController(
    new GetPublicationContactSettingsService(publications, contacts),
    new ReplacePublicationContactSettingsService(contacts),
  )
  const contactController = new ContactController(
    new GetPublicationContactService(contacts),
  )
  const contactRateLimiters = createContactRateLimiters()
  const imageController = new PublicationImageController(
    new UploadPublicationImagesService(
      publications,
      images,
      imageProcessor,
      imageStorage,
    ),
    new DeletePublicationImageService(images, deletionJobs),
    new ReorderPublicationImagesService(images),
  )
  const router = Router()
  router.get('/', controller.list)
  router.get('/mine', auth, controller.mine)
  router.get('/:id/manage', auth, controller.manage)
  router.get('/:id/contact-settings', auth, contactSettingsController.get)
  router.get(
    '/:id/contact',
    auth,
    privateNoStore,
    contactRateLimiters.byUser,
    contactRateLimiters.byIp,
    contactController.get,
  )
  router.get('/:id', controller.get)
  router.post('/', requireTrustedOrigin, auth, controller.create)
  router.put(
    '/:id/contact-settings',
    requireTrustedOrigin,
    auth,
    contactSettingsController.replace,
  )
  router.post(
    '/:id/images',
    requireTrustedOrigin,
    auth,
    imageUploadRateLimit,
    parseImageUpload,
    imageController.upload,
  )
  router.delete(
    '/:id/images/:imageId',
    requireTrustedOrigin,
    auth,
    imageController.delete,
  )
  router.patch(
    '/:id/images/order',
    requireTrustedOrigin,
    auth,
    imageController.reorder,
  )
  router.patch('/:id', requireTrustedOrigin, auth, controller.update)
  router.patch('/:id/status', requireTrustedOrigin, auth, controller.status)
  return router
}
