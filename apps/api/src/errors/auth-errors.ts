import { AppError } from './app-error.js'

export class InvalidCredentialsError extends AppError {
  constructor() {
    super({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Credenciales inválidas',
    })
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super({
      statusCode: 401,
      code: 'AUTH_UNAUTHENTICATED',
      message: 'Autenticación requerida',
    })
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super({
      statusCode: 403,
      code: 'AUTH_FORBIDDEN',
      message: 'Acceso no permitido',
    })
  }
}

export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super({
      statusCode: 409,
      code: 'AUTH_EMAIL_ALREADY_EXISTS',
      message: 'No se puede crear la cuenta',
    })
  }
}
