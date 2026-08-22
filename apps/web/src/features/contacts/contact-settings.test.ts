import { describe, expect, it } from 'vitest'

import {
  emptyContactSettings,
  fromContactMethods,
  normalizePhone,
  toContactMethods,
} from './contact-settings'

describe('contact settings form', () => {
  it('starts without enabled methods', () => {
    expect(toContactMethods(emptyContactSettings)).toEqual([])
  })

  it('normalizes only spaces and hyphens in international phones', () => {
    expect(normalizePhone('+34 600-111-222')).toBe('+34600111222')
    expect(() =>
      toContactMethods({
        ...emptyContactSettings,
        phoneEnabled: true,
        phone: '(+34) 600 111 222',
      }),
    ).toThrow()
  })

  it('trims and lowercases contact email', () => {
    expect(
      toContactMethods({
        ...emptyContactSettings,
        emailEnabled: true,
        email: ' Contacto@Example.COM ',
      }),
    ).toEqual([{ type: 'EMAIL', value: 'contacto@example.com' }])
  })

  it('maps saved methods without deriving the account email', () => {
    expect(
      fromContactMethods([{ type: 'PHONE', value: '+34600111222' }]),
    ).toEqual({
      ...emptyContactSettings,
      phoneEnabled: true,
      phone: '+34600111222',
    })
  })
})
