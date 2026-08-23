import type { NextFunction, Request, Response } from 'express'
import { ValidationError } from '../errors/app-error.js'
import { VisualSearchImageRequiredError } from '../errors/visual-search-api-errors.js'
import type { SearchPublicationsByImageService } from '../services/visual-search.service.js'
import { visualSearchFieldsSchema } from '../visual-search/visual-search-api.js'

export class VisualSearchController {
  constructor(private readonly service: SearchPublicationsByImageService) {}

  search = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.file) throw new VisualSearchImageRequiredError()
      const filters = parseOrThrow(
        visualSearchFieldsSchema.safeParse(request.body),
      )
      const result = await this.service.execute(request.file.buffer, {
        limit: filters.limit,
        ...(filters.targetType ? { targetType: filters.targetType } : {}),
        ...(filters.species ? { species: filters.species } : {}),
      })
      response.set('Content-Type', 'application/json; charset=utf-8')
      response.status(200).end(JSON.stringify({ items: result.items }))
    } catch (error) {
      next(error)
    }
  }
}

function parseOrThrow<T>(
  result: { success: true; data: T } | { success: false; error: unknown },
): T {
  if (!result.success)
    throw new ValidationError('La solicitud no es válida', result.error)
  return result.data
}
