import { describe, expect, it } from 'vitest'

import {
  buildContactMessage,
  buildEmailContactUrl,
  buildTelephoneContactUrl,
  buildWhatsAppContactUrl,
  sanitizeReturnTo,
} from './contact-links'

describe('contact link helpers', () => {
  const specialName = `Nube & Sol? #100% "canela"`

  it('builds generic and named messages without HTML interpolation', () => {
    expect(buildContactMessage()).toBe(
      'Hola, te contacto por tu publicación en Red Huella.',
    )
    expect(buildContactMessage(specialName)).toContain(specialName)
  })

  it('builds an exact wa.me URL and encodes special characters once', () => {
    const value = buildWhatsAppContactUrl('+34600111222', specialName)
    expect(value).toBeDefined()
    const url = new URL(value!)
    expect(url.protocol).toBe('https:')
    expect(url.hostname).toBe('wa.me')
    expect(url.pathname).toBe('/34600111222')
    expect(url.searchParams.get('text')).toBe(buildContactMessage(specialName))
    expect(buildWhatsAppContactUrl('javascript:alert(1)')).toBeUndefined()
  })

  it('only builds tel for E.164', () => {
    expect(buildTelephoneContactUrl('+34600111222')).toBe('tel:+34600111222')
    expect(buildTelephoneContactUrl('600111222')).toBeUndefined()
  })

  it('builds encoded mailto subject/body and rejects unsafe email', () => {
    const value = buildEmailContactUrl('contacto@example.com', specialName)
    expect(value?.startsWith('mailto:contacto@example.com?')).toBe(true)
    const params = new URLSearchParams(value?.split('?')[1])
    expect(params.get('subject')).toBe(
      `Red Huella — publicación de ${specialName}`,
    )
    expect(params.get('body')).toBe(buildContactMessage(specialName))
    expect(buildEmailContactUrl('bad@example.com?subject=evil')).toBeUndefined()
  })
})

describe('sanitizeReturnTo', () => {
  it.each([
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['data:text/html,evil', '/'],
    ['/login', '/'],
    ['/register?returnTo=/login', '/'],
    [
      '/publications/123?tab=detail#contact',
      '/publications/123?tab=detail#contact',
    ],
  ])('sanitizes %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected)
  })
})
