import { defineConfig } from 'drizzle-kit'

import { env } from './src/config/index.js'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
  verbose: true,
})
