import type { RequestHandler, Response } from 'express'

import { contactSettingsBodySchema } from '../contacts/schemas.js'
import { ValidationError } from '../errors/app-error.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import { publicationIdSchema } from '../publications/schemas.js'
import type {
  GetPublicationContactSettingsService,
  ReplacePublicationContactSettingsService,
} from '../services/contact-settings.services.js'

function parseOrThrow<T>(
  result: { success: true; data: T } | { success: false; error: unknown },
): T {
  if (!result.success)
    throw new ValidationError('Datos de contacto no válidos', result.error)
  return result.data
}

function sendPrivateJson(response: Response, body: unknown) {
  response.set({
    'Cache-Control': 'private, no-store',
    Pragma: 'no-cache',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.status(200).end(JSON.stringify(body))
}

export class ContactSettingsController {
  constructor(
    private readonly getSettings: GetPublicationContactSettingsService,
    private readonly replaceSettings: ReplacePublicationContactSettingsService,
  ) {}

  get: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const { id } = parseOrThrow(publicationIdSchema.safeParse(request.params))
      sendPrivateJson(response, {
        contactSettings: await this.getSettings.execute(
          id,
          request.auth.userId,
        ),
      })
    } catch (error: unknown) {
      next(error)
    }
  }

  replace: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const { id } = parseOrThrow(publicationIdSchema.safeParse(request.params))
      const { methods } = parseOrThrow(
        contactSettingsBodySchema.safeParse(request.body),
      )
      sendPrivateJson(response, {
        contactSettings: await this.replaceSettings.execute(
          id,
          request.auth.userId,
          methods,
        ),
      })
    } catch (error: unknown) {
      next(error)
    }
  }
}
