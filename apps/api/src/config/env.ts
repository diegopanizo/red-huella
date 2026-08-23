import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

dotenv.config({
  path: new URL('../../../../.env', import.meta.url),
  quiet: true,
})

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))

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
  IMAGE_STORAGE_DRIVER: z.literal('local').default('local'),
  IMAGE_STORAGE_LOCAL_ROOT: z
    .string()
    .trim()
    .min(1)
    .default('.data/uploads')
    .transform((value) => path.resolve(repositoryRoot, value)),
  VISUAL_MODEL_PATH: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value) =>
      value === undefined ? undefined : path.resolve(repositoryRoot, value),
    ),
  VISUAL_EMBEDDING_PROCESSOR_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  VISUAL_EMBEDDING_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(3_600_000)
    .default(30_000),
  VISUAL_EMBEDDING_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5),
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
