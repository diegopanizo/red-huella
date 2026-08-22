import type { RequestHandler, Response } from 'express'

import { ValidationError } from '../errors/app-error.js'
import { publicationIdSchema } from '../publications/schemas.js'
import type { GetPublicationContactService } from '../services/publication-contact.service.js'

function sendPrivateJson(response: Response, body: unknown) {
  response.set('Content-Type', 'application/json; charset=utf-8')
  response.status(200).end(JSON.stringify(body))
}

export class ContactController {
  constructor(private readonly getContact: GetPublicationContactService) {}

  get: RequestHandler = async (request, response, next) => {
    try {
      const parsed = publicationIdSchema.safeParse(request.params)
      if (!parsed.success)
        throw new ValidationError('Identificador de publicación no válido')
      sendPrivateJson(response, {
        contact: await this.getContact.execute(parsed.data.id),
      })
    } catch (error: unknown) {
      next(error)
    }
  }
}
