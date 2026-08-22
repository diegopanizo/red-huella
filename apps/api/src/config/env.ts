import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({
  path: new URL('../../../../.env', import.meta.url),
  quiet: true,
})

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65_535),
  WEB_ORIGIN: z.url().refine((value) => !value.endsWith('/'), {
    message: 'WEB_ORIGIN no debe terminar en /',
  }),
  DATABASE_URL: z.string().refine(
    (value) => {
      try {
        return ['postgres:', 'postgresql:'].includes(new URL(value).protocol)
      } catch {
        return false
      }
    },
    { message: 'DATABASE_URL debe ser una URL PostgreSQL válida' },
  ),
  LOG_LEVEL: z.enum([
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ]),
})

export type Environment = z.infer<typeof environmentSchema>

export function parseEnvironment(
  input: NodeJS.ProcessEnv,
): Readonly<Environment> {
  const result = environmentSchema.safeParse(input)

  if (!result.success) {
    throw new Error(
      `Configuración de entorno no válida: ${z.prettifyError(result.error)}`,
    )
  }

  return Object.freeze(result.data)
}

export const env = parseEnvironment(process.env)
