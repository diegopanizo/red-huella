import pino from 'pino'

import { env } from '../config/index.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: null,
  redact: {
    paths: [
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'token',
      '*.token',
      'tokenHash',
      '*.tokenHash',
      'authorization',
      'cookie',
      'DATABASE_URL',
    ],
    censor: '[REDACTED]',
  },
})
