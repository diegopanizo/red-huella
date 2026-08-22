import { describe, expect, it } from 'vitest'

import {
  AppError,
  DatabaseError,
  InternalError,
  NotFoundError,
  ValidationError,
  mapToAppError,
} from './app-error.js'

describe('application errors', () => {
  it.each([
    [new ValidationError(), 400, 'APP_VALIDATION_ERROR'],
    [new NotFoundError(), 404, 'APP_NOT_FOUND'],
    [new DatabaseError(), 503, 'APP_DATABASE_ERROR'],
    [new InternalError(), 500, 'APP_INTERNAL_ERROR'],
  ])('expone status y código estables', (error, statusCode, code) => {
    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(statusCode)
    expect(error.code).toBe(code)
  })

  it('conserva errores operacionales conocidos', () => {
    const error = new NotFoundError()
    expect(mapToAppError(error)).toBe(error)
  })

  it('sanitiza errores desconocidos como errores internos', () => {
    const originalError = new Error('detalle SQL privado')
    const mappedError = mapToAppError(originalError)
    expect(mappedError).toBeInstanceOf(InternalError)
    expect(mappedError.message).not.toContain('SQL')
    expect(mappedError.cause).toBe(originalError)
  })
})
