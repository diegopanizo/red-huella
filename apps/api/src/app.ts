import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      credentials: true,
      origin: env.WEB_ORIGIN,
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/v1/health', (_request, response) => {
    response.status(200).json({ status: 'ok' })
  })

  return app
}
