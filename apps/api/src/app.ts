import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/index.js'
import { databaseProbe } from './database/client.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import { requestId } from './middleware/request-id.js'
import { requestLogger } from './middleware/request-logger.js'
import { createHealthRouter } from './routes/health.routes.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { HealthService } from './services/health.service.js'

export interface AppDependencies {
  healthService?: HealthService
  authRouter?: express.Router
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express()
  const healthService =
    dependencies.healthService ?? new HealthService(databaseProbe)

  app.disable('x-powered-by')
  app.use(requestId)
  app.use(requestLogger)
  app.use(helmet())
  app.use(
    cors({
      credentials: true,
      origin: env.WEB_ORIGIN,
    }),
  )
  app.use(express.json({ limit: '100kb', type: 'application/json' }))

  app.use('/api/v1/health', createHealthRouter(healthService))
  app.use('/api/v1/auth', dependencies.authRouter ?? createAuthRouter())
  app.use(notFound)
  app.use(errorHandler)

  return app
}
