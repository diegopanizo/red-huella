import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { env } from '../config/index.js'
import { DatabaseError } from '../errors/app-error.js'
import * as schema from './schema/index.js'

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export const db = drizzle({ client: pool, schema })

export const databaseProbe = {
  async check(): Promise<void> {
    try {
      await pool.query('select 1')
    } catch (error: unknown) {
      throw new DatabaseError(error)
    }
  },
}

export async function closeDatabase(): Promise<void> {
  await pool.end()
}
