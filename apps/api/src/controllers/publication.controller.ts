import type { RequestHandler } from 'express'

import {
  createPublicationSchema,
  changePublicationStatusSchema,
  listPublicationsSchema,
  publicationIdSchema,
  updatePublicationSchema,
} from '../publications/schemas.js'
import { ValidationError } from '../errors/app-error.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import type {
  ChangePublicationStatusService,
  CreatePublicationService,
  GetPublicationService,
  ListPublicationsService,
  UpdatePublicationService,
} from '../services/publication.services.js'

function parseOrThrow<T>(
  result: { success: true; data: T } | { success: false; error: unknown },
): T {
  if (!result.success)
    throw new ValidationError('Datos de publicación no válidos', result.error)
  return result.data
}

export class PublicationController {
  constructor(
    private readonly createPublication: CreatePublicationService,
    private readonly getPublication: GetPublicationService,
    private readonly listPublications: ListPublicationsService,
    private readonly updatePublication: UpdatePublicationService,
    private readonly changeStatus: ChangePublicationStatusService,
  ) {}

  create: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const command = parseOrThrow(
        createPublicationSchema.safeParse(request.body),
      )
      response.status(201).json({
        publication: await this.createPublication.execute({
          ...command,
          userId: request.auth.userId,
        }),
      })
    } catch (error: unknown) {
      next(error)
    }
  }
  get: RequestHandler = async (request, response, next) => {
    try {
      const { id } = parseOrThrow(publicationIdSchema.safeParse(request.params))
      response.json({ publication: await this.getPublication.execute(id) })
    } catch (error: unknown) {
      next(error)
    }
  }
  list: RequestHandler = async (request, response, next) => {
    try {
      response.json(
        await this.listPublications.execute(
          parseOrThrow(listPublicationsSchema.safeParse(request.query)),
        ),
      )
    } catch (error: unknown) {
      next(error)
    }
  }
  mine: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      response.json(
        await this.listPublications.mine(
          parseOrThrow(listPublicationsSchema.safeParse(request.query)),
          request.auth.userId,
        ),
      )
    } catch (error: unknown) {
      next(error)
    }
  }
  update: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const { id } = parseOrThrow(publicationIdSchema.safeParse(request.params))
      const command = parseOrThrow(
        updatePublicationSchema.safeParse(request.body),
      )
      response.json({
        publication: await this.updatePublication.execute(
          id,
          request.auth.userId,
          command,
        ),
      })
    } catch (error: unknown) {
      next(error)
    }
  }
  status: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const { id } = parseOrThrow(publicationIdSchema.safeParse(request.params))
      const { status } = parseOrThrow(
        changePublicationStatusSchema.safeParse(request.body),
      )
      response.json({
        publication: await this.changeStatus.execute(
          id,
          request.auth.userId,
          status,
        ),
      })
    } catch (error: unknown) {
      next(error)
    }
  }
}
