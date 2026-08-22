import { Pool } from 'pg'

import { env } from '../config/index.js'

interface PreflightRow {
  database: string
  postgisAvailable: boolean
  postgisInstalled: boolean
  port: number
  postgresVersion: string
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5_000,
})

try {
  const result = await pool.query<PreflightRow>(`
    select
      current_database() as "database",
      inet_server_port() as "port",
      current_setting('server_version') as "postgresVersion",
      exists (
        select 1
        from pg_available_extensions
        where name = 'postgis'
      ) as "postgisAvailable",
      exists (
        select 1
        from pg_extension
        where extname = 'postgis'
      ) as "postgisInstalled"
  `)
  const row = result.rows[0]
  if (!row) throw new Error('PostGIS preflight returned no result')

  let postgisFullVersion: string | null = null
  if (row.postgisInstalled) {
    const versionResult = await pool.query<{ version: string }>(
      'select postgis_full_version() as version',
    )
    postgisFullVersion = versionResult.rows[0]?.version ?? null
  }

  console.log(
    JSON.stringify(
      {
        postgresVersion: row.postgresVersion,
        port: row.port,
        database: row.database,
        postgisAvailable: row.postgisAvailable,
        postgisInstalled: row.postgisInstalled,
        postgisFullVersion,
      },
      null,
      2,
    ),
  )
} catch {
  console.error(
    'No se pudo completar el preflight PostGIS. Revisa que DATABASE_URL apunte a la instancia y base correctas.',
  )
  process.exitCode = 1
} finally {
  await pool.end()
}
