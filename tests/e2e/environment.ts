import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))

function derivedE2EDatabaseUrl(): string | undefined {
  const source = process.env.DATABASE_TEST_URL
  if (!source) return undefined
  const url = new URL(source)
  const testName = url.pathname.slice(1)
  url.pathname = `/${testName.replace(/_test$/, '')}_e2e`
  return url.toString()
}

export function e2eDatabaseUrl(): string {
  const value = process.env.DATABASE_E2E_URL ?? derivedE2EDatabaseUrl()
  if (!value)
    throw new Error(
      'DATABASE_E2E_URL es obligatoria si no existe DATABASE_TEST_URL',
    )
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_E2E_URL debe ser PostgreSQL')
  const databaseName = url.pathname.slice(1)
  if (!/^[a-z0-9_]+_e2e$/.test(databaseName))
    throw new Error('La base E2E debe tener un nombre seguro terminado en _e2e')
  return value
}

export const e2eStorageRoot = path.join(repositoryRoot, '.data', 'e2e')
