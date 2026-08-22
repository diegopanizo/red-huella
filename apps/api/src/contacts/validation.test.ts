import { describe, expect, it } from 'vitest'

import { normalizePublicationContactSettings } from './validation.js'

describe('publication contact validation', () => {
  it.each(['+12345678', '+34600111222', '+123456789012345'])(
    'accepts canonical E.164 %s',
    (value) => {
      expect(
        normalizePublicationContactSettings([{ type: 'PHONE', value }]),
      ).toEqual([{ type: 'PHONE', value }])
    },
  )

  it.each([
    '+1234567',
    '+1234567890123456',
    '34600111222',
    '+012345678',
    '+34 600111222',
    '+34-600111222',
    '+34abcdefghi',
  ])('rejects non-canonical E.164 %s', (value) => {
    expect(() =>
      normalizePublicationContactSettings([{ type: 'WHATSAPP', value }]),
    ).toThrow()
  })

  it('trims and lowercases email', () => {
    expect(
      normalizePublicationContactSettings([
        { type: 'EMAIL', value: '  Contacto@Example.COM  ' },
      ]),
    ).toEqual([{ type: 'EMAIL', value: 'contacto@example.com' }])
  })

  it.each(['not-an-email', `a@${'x'.repeat(250)}.com`])(
    'rejects invalid email %s',
    (value) => {
      expect(() =>
        normalizePublicationContactSettings([{ type: 'EMAIL', value }]),
      ).toThrow()
    },
  )

  it('accepts an empty collection', () => {
    expect(normalizePublicationContactSettings([])).toEqual([])
  })

  it('accepts three different methods without copying values', () => {
    expect(
      normalizePublicationContactSettings([
        { type: 'WHATSAPP', value: '+34600111222' },
        { type: 'PHONE', value: '+34911111222' },
        { type: 'EMAIL', value: 'contact@example.com' },
      ]),
    ).toHaveLength(3)
  })

  it('rejects duplicate methods', () => {
    expect(() =>
      normalizePublicationContactSettings([
        { type: 'PHONE', value: '+34911111222' },
        { type: 'PHONE', value: '+34922222333' },
      ]),
    ).toThrow()
  })

  it('rejects more than three methods', () => {
    expect(() =>
      normalizePublicationContactSettings([
        { type: 'PHONE', value: '+34911111222' },
        { type: 'WHATSAPP', value: '+34600111222' },
        { type: 'EMAIL', value: 'contact@example.com' },
        { type: 'EMAIL', value: 'second@example.com' },
      ]),
    ).toThrow()
  })
})
