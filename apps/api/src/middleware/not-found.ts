import type { RequestHandler } from 'express'

import { NotFoundError } from '../errors/app-error.js'

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new NotFoundError())
}
