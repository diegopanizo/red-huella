import { AppError } from './app-error.js'

export class ContactSettingsReadOnlyForStatusError extends AppError {
  constructor() {
    super({
      statusCode: 409,
      code: 'CONTACT_SETTINGS_READ_ONLY_FOR_STATUS',
      message: 'En el estado actual solo se pueden retirar métodos de contacto',
    })
  }
}

export class ContactNotAvailableError extends AppError {
  constructor() {
    super({
      statusCode: 404,
      code: 'CONTACT_NOT_AVAILABLE',
      message: 'Contacto no disponible',
    })
  }
}
