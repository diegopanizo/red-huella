import { describe, expect, it } from 'vitest'

import { parseEnvironment } from './env.js'

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/red_huella_test',
  LOG_LEVEL: 'silent',
}

describe('parseEnvironment', () => {
  it('valida y convierte una configuración completa', () => {
    expect(parseEnvironment(validEnvironment)).toEqual({
      ...validEnvironment,
      PORT: 3000,
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
})
