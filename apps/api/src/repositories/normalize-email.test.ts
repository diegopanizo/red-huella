import { describe, expect, it } from 'vitest'

import { normalizeEmail } from './normalize-email.js'

describe('normalizeEmail', () => {
  it('elimina espacios exteriores y normaliza mayúsculas', () => {
    expect(normalizeEmail('  Persona.Ejemplo@Example.COM ')).toBe(
      'persona.ejemplo@example.com',
    )
  })
})
