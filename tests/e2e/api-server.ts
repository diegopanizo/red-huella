import { createApp } from '../../apps/api/src/app.js'
import { env } from '../../apps/api/src/config/index.js'
import { closeDatabase } from '../../apps/api/src/database/client.js'

const server = createApp().listen(env.PORT)
let stopping = false

async function stop(): Promise<void> {
  if (stopping) return
  stopping = true
  server.closeAllConnections()
  server.close()
  await closeDatabase()
  process.exit(0)
}

process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
