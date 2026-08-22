import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({
  path: new URL('../../../../.env', import.meta.url),
  quiet: true,
})

const postgresUrlSchema = z.string().refine(
  (value) => {
    try {
      return ['postgres:', 'postgresql:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  },
  { message: 'Debe ser una URL PostgreSQL válida' },
)

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65_535),
  WEB_ORIGIN: z.url().refine((value) => !value.endsWith('/'), {
    message: 'WEB_ORIGIN no debe terminar en /',
  }),
  DATABASE_URL: postgresUrlSchema,
  DATABASE_TEST_URL: postgresUrlSchema.optional(),
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
