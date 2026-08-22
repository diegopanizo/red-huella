import pino from 'pino'

import { env } from '../config/index.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: null,
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'authorization',
      'cookie',
      'DATABASE_URL',
    ],
    censor: '[REDACTED]',
  },
})
