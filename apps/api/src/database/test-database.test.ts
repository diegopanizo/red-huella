import { describe, expect, it } from 'vitest'

import type { Environment } from '../config/index.js'
import { assertSafeTestDatabaseUrl } from './test-database.js'

const safeEnvironment: Environment = {
  NODE_ENV: 'test',
  PORT: 3000,
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:password@localhost/red_huella',
  DATABASE_TEST_URL: 'postgresql://user:password@localhost/red_huella_test',
  LOG_LEVEL: 'silent',
}

describe('assertSafeTestDatabaseUrl', () => {
  it('acepta una base separada con sufijo de test', () => {
    expect(assertSafeTestDatabaseUrl(safeEnvironment)).toBe(
      safeEnvironment.DATABASE_TEST_URL,
    )
  })

  it.each([
    [{ ...safeEnvironment, NODE_ENV: 'production' as const }, /NODE_ENV=test/],
    [
      { ...safeEnvironment, DATABASE_TEST_URL: undefined },
      /DATABASE_TEST_URL es obligatoria/,
    ],
    [
      { ...safeEnvironment, DATABASE_TEST_URL: safeEnvironment.DATABASE_URL },
      /debe ser distinta/,
    ],
    [
      {
        ...safeEnvironment,
        DATABASE_TEST_URL:
          'postgresql://user:password@localhost/red_huella_staging',
      },
      /debe terminar en _test/,
    ],
  ])(
    'rechaza configuraciones capaces de apuntar a datos no aislados',
    (environment, message) => {
      expect(() => assertSafeTestDatabaseUrl(environment)).toThrow(message)
    },
  )
})
