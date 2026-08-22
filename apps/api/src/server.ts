import { createApp } from './app.js'
import { env } from './config/index.js'
import { closeDatabase } from './database/client.js'
import { logger } from './logging/logger.js'

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API started')
})

let shuttingDown = false

async function shutDown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, 'graceful shutdown started')

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    await closeDatabase()
    logger.info('graceful shutdown completed')
  } catch (error: unknown) {
    process.exitCode = 1
    logger.error({ err: error }, 'graceful shutdown failed')
  }
}

process.on('SIGINT', () => void shutDown('SIGINT'))
process.on('SIGTERM', () => void shutDown('SIGTERM'))
