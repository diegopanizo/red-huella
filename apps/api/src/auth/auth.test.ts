import { describe, expect, it } from 'vitest'

import { Argon2PasswordHasher, passwordPolicy } from './password.js'
import {
  getClearSessionCookieOptions,
  getSessionCookieOptions,
} from './cookie.js'
import { loginSchema, registerSchema } from './schemas.js'
import {
  createSessionToken,
  hashSessionToken,
  sessionTtlSeconds,
} from './session-token.js'

describe('authentication primitives', () => {
  it('hashes and verifies passwords with Argon2id without storing plaintext', async () => {
    const passwords = new Argon2PasswordHasher()
    const hash = await passwords.hash('correct horse battery staple')
    expect(hash).toMatch(/^\$argon2id\$/)
    expect(hash).not.toContain('correct horse battery staple')
    await expect(
      passwords.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true)
    await expect(passwords.verify(hash, 'incorrect password')).resolves.toBe(
      false,
    )
    expect(passwords.needsRehash(hash)).toBe(false)
  })

  it('creates opaque 256-bit tokens, stable hashes and a seven-day expiry', () => {
    const now = new Date('2026-08-22T10:00:00Z')
    const first = createSessionToken(now)
    const second = createSessionToken(now)
    expect(first.token).not.toBe(second.token)
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSessionToken(first.token)).toBe(first.tokenHash)
    expect(first.expiresAt.getTime() - now.getTime()).toBe(
      sessionTtlSeconds * 1000,
    )
  })

  it('uses restrictive cookies and enables Secure only in production', () => {
    const expiresAt = new Date('2026-08-29T10:00:00Z')
    expect(getSessionCookieOptions('development', expiresAt)).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/api/v1',
      maxAge: sessionTtlSeconds * 1000,
      expires: expiresAt,
    })
    expect(getSessionCookieOptions('production', expiresAt)).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/api/v1',
    })
    expect(getClearSessionCookieOptions('development')).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/api/v1',
    })
    expect(getClearSessionCookieOptions('production')).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/api/v1',
    })
  })

  it('rejects short/oversized passwords and unexpected public roles', () => {
    expect(passwordPolicy).toEqual({ minLength: 12, maxLength: 128 })
    expect(
      loginSchema.safeParse({ email: 'bad', password: 'x'.repeat(12) }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({
        name: 'Diego',
        email: 'd@example.test',
        password: 'short',
      }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({
        name: 'Diego',
        email: 'd@example.test',
        password: 'x'.repeat(12),
        role: 'ADMIN',
      }).success,
    ).toBe(false)
  })
})
