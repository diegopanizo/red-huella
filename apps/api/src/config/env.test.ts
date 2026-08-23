import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseEnvironment } from './env.js'

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/red_huella_test',
  LOG_LEVEL: 'silent',
  IMAGE_STORAGE_DRIVER: 'local',
  IMAGE_STORAGE_LOCAL_ROOT: '.data/uploads',
}

const expectedStorageRoot = fileURLToPath(
  new URL('../../../../.data/uploads', import.meta.url),
)

describe('parseEnvironment', () => {
  it('valida y convierte una configuración completa', () => {
    expect(parseEnvironment(validEnvironment)).toEqual({
      ...validEnvironment,
      PORT: 3000,
      IMAGE_STORAGE_LOCAL_ROOT: expectedStorageRoot,
      VISUAL_EMBEDDING_PROCESSOR_ENABLED: false,
      VISUAL_EMBEDDING_POLL_INTERVAL_MS: 30_000,
      VISUAL_EMBEDDING_BATCH_SIZE: 5,
    })
  })

  it('falla rápido cuando falta una variable obligatoria', () => {
    const incompleteEnvironment = { ...validEnvironment }
    delete incompleteEnvironment.DATABASE_URL
    expect(() => parseEnvironment(incompleteEnvironment)).toThrow(
      /expected string.*DATABASE_URL/s,
    )
  })

  it('rechaza puertos y orígenes inválidos', () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, PORT: '70000', WEB_ORIGIN: '*' }),
    ).toThrow(/Configuración de entorno no válida/)
  })
  it('solo acepta el driver local y una ruta no vacia', () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, IMAGE_STORAGE_DRIVER: 's3' }),
    ).toThrow(/Configuraci/)
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        IMAGE_STORAGE_LOCAL_ROOT: '   ',
      }),
    ).toThrow(/Configuraci/)
  })

  it('valida la configuracion del procesador visual', () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        VISUAL_EMBEDDING_PROCESSOR_ENABLED: 'yes',
      }),
    ).toThrow(/Configuraci/)
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        VISUAL_EMBEDDING_POLL_INTERVAL_MS: '4999',
      }),
    ).toThrow(/Configuraci/)
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        VISUAL_EMBEDDING_BATCH_SIZE: '51',
      }),
    ).toThrow(/Configuraci/)
  })
})
