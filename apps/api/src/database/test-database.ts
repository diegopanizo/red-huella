import type { Environment } from '../config/index.js'

export function assertSafeTestDatabaseUrl(
  environment: Readonly<Environment>,
): string {
  if (environment.NODE_ENV !== 'test') {
    throw new Error('Los tests de base de datos requieren NODE_ENV=test')
  }

  if (!environment.DATABASE_TEST_URL) {
    throw new Error(
      'DATABASE_TEST_URL es obligatoria para los tests de base de datos',
    )
  }

  if (environment.DATABASE_TEST_URL === environment.DATABASE_URL) {
    throw new Error('DATABASE_TEST_URL debe ser distinta de DATABASE_URL')
  }

  const databaseName = new URL(environment.DATABASE_TEST_URL).pathname.slice(1)
  if (!databaseName.endsWith('_test')) {
    throw new Error('La base de datos de test debe terminar en _test')
  }

  return environment.DATABASE_TEST_URL
}
