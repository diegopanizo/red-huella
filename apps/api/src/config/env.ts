import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({
  path: new URL('../../../../.env', import.meta.url),
  quiet: true,
})

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
})

const parsedEnvironment = environmentSchema.safeParse(process.env)

if (!parsedEnvironment.success) {
  throw new Error(
    `Configuración de entorno no válida: ${z.prettifyError(parsedEnvironment.error)}`,
  )
}

export const env = Object.freeze(parsedEnvironment.data)
