import { createApp } from './app.js'
import { env } from './config/index.js'
import { closeDatabase } from './database/client.js'
import { logger } from './logging/logger.js'
import { createVisualEmbeddingProcessor } from './visual-search/create-visual-embedding-processor.js'

const visualEmbeddingProcessor = createVisualEmbeddingProcessor()
const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API started')
  if (
    env.VISUAL_EMBEDDING_PROCESSOR_ENABLED &&
    env.VISUAL_MODEL_PATH === undefined
  )
    logger.warn(
      { code: 'MODEL_NOT_CONFIGURED' },
      'visual embedding processor disabled',
    )
  else visualEmbeddingProcessor.start()
})

let shuttingDown = false

async function shutDown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, 'graceful shutdown started')

  try {
    await visualEmbeddingProcessor.stop()
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
