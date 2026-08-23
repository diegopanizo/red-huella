import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client, Pool } from 'pg'

import * as schema from '../../apps/api/src/database/schema/index.js'
import {
  e2eDatabaseUrl,
  e2eStorageRoot,
  repositoryRoot,
} from './environment.js'

async function ensureDatabase(urlValue: string): Promise<void> {
  const target = new URL(urlValue)
  const databaseName = target.pathname.slice(1)
  const maintenance = new URL(target)
  maintenance.pathname = '/postgres'
  const client = new Client({
    connectionString: maintenance.toString(),
    connectionTimeoutMillis: 5_000,
  })
  await client.connect()
  try {
    const existing = await client.query(
      'select 1 from pg_database where datname = $1',
      [databaseName],
    )
    if (existing.rowCount === 0)
      await client.query(`create database "${databaseName}"`)
  } finally {
    await client.end()
  }
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`El servidor E2E no respondio a tiempo: ${url}`)
}

async function assertPortIsAvailable(url: string): Promise<void> {
  try {
    await fetch(url)
  } catch {
    return
  }
  throw new Error(`El puerto E2E ya esta ocupado: ${url}`)
}

function startServer(
  entrypoint: string,
  environment: NodeJS.ProcessEnv,
): ChildProcess {
  const child = spawn(process.execPath, ['--import', 'tsx', entrypoint], {
    cwd: repositoryRoot,
    env: environment,
    stdio: 'ignore',
  })
  child.unref()
  return child
}

export default async function globalSetup(): Promise<void> {
  const url = e2eDatabaseUrl()
  await ensureDatabase(url)
  const pool = new Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 5_000,
  })
  const database = drizzle({ client: pool, schema })
  try {
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL('../../apps/api/src/database/migrations', import.meta.url),
      ),
    })
    await database.delete(schema.storageDeletionJobs)
    await database.delete(schema.publicationImageEmbeddings)
    await database.delete(schema.publicationContactMethods)
    await database.delete(schema.sessions)
    await database.delete(schema.publicationImages)
    await database.delete(schema.publications)
    await database.delete(schema.animals)
    await database.delete(schema.users)
  } finally {
    await pool.end()
  }

  const relativeStorage = path
    .relative(repositoryRoot, e2eStorageRoot)
    .replaceAll('\\', '/')
  if (relativeStorage !== '.data/e2e')
    throw new Error('El storage E2E resuelto no es seguro')
  await rm(e2eStorageRoot, { recursive: true, force: true })
  await mkdir(e2eStorageRoot, { recursive: true })

  await Promise.all([
    assertPortIsAvailable('http://127.0.0.1:3100/api/v1/health'),
    assertPortIsAvailable('http://127.0.0.1:5174'),
  ])

  const api = startServer('tests/e2e/api-server.ts', {
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3100',
    WEB_ORIGIN: 'http://127.0.0.1:5174',
    DATABASE_URL: url,
    LOG_LEVEL: 'silent',
    IMAGE_STORAGE_DRIVER: 'local',
    IMAGE_STORAGE_LOCAL_ROOT: e2eStorageRoot,
    VISUAL_EMBEDDING_PROCESSOR_ENABLED: 'false',
  })
  const web = startServer('tests/e2e/web-server.ts', process.env)
  const pids = [api.pid, web.pid]
  if (pids.some((pid) => pid === undefined))
    throw new Error('No se pudieron obtener los PID de los servidores E2E')
  await writeFile(
    path.join(e2eStorageRoot, 'server-pids.json'),
    JSON.stringify(pids),
    'utf8',
  )
  await Promise.all([
    waitForServer('http://127.0.0.1:3100/api/v1/health'),
    waitForServer('http://127.0.0.1:5174'),
  ])
}
