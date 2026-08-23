import { AppError, ValidationError } from './app-error.js'

export class VisualSearchImageRequiredError extends ValidationError {
  constructor() {
    super('Debe incluir exactamente una imagen')
  }
}

export class VisualSearchUnavailableError extends AppError {
  constructor() {
    super({
      statusCode: 503,
      code: 'VISUAL_SEARCH_UNAVAILABLE',
      message: 'La búsqueda visual no está disponible',
    })
  }
}
