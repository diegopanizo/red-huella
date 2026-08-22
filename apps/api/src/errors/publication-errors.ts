import { AppError } from './app-error.js'

export class PublicationNotFoundError extends AppError {
  constructor() {
    super({
      statusCode: 404,
      code: 'PUBLICATION_NOT_FOUND',
      message: 'Publicación no encontrada',
    })
  }
}

export class PublicationForbiddenError extends AppError {
  constructor() {
    super({
      statusCode: 403,
      code: 'PUBLICATION_FORBIDDEN',
      message: 'No puedes modificar esta publicación',
    })
  }
}

export class InvalidPublicationStatusTransitionError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'PUBLICATION_INVALID_STATUS_TRANSITION',
      message: 'Transición de estado no válida',
    })
  }
}

export class PublicationValidationError extends AppError {
  constructor(message = 'Datos de publicación no válidos') {
    super({ statusCode: 400, code: 'PUBLICATION_VALIDATION_ERROR', message })
  }
}
