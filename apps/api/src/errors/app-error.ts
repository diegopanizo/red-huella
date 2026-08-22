export interface AppErrorOptions {
  statusCode: number
  code: string
  message: string
  operational?: boolean
  cause?: unknown
}

export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly operational: boolean

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause })
    this.name = new.target.name
    this.statusCode = options.statusCode
    this.code = options.code
    this.operational = options.operational ?? true
  }
}

export class ValidationError extends AppError {
  constructor(message = 'La solicitud no es válida', cause?: unknown) {
    super({ statusCode: 400, code: 'APP_VALIDATION_ERROR', message, cause })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super({ statusCode: 404, code: 'APP_NOT_FOUND', message })
  }
}

export class DatabaseError extends AppError {
  constructor(cause?: unknown) {
    super({
      statusCode: 503,
      code: 'APP_DATABASE_ERROR',
      message: 'El servicio de datos no está disponible',
      cause,
    })
  }
}

export class InternalError extends AppError {
  constructor(cause?: unknown) {
    super({
      statusCode: 500,
      code: 'APP_INTERNAL_ERROR',
      message: 'Error interno del servidor',
      operational: false,
      cause,
    })
  }
}

export function mapToAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new InternalError(error)
}
