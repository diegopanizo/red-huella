import type { CookieOptions } from 'express'

import { sessionTtlSeconds } from './session-token.js'

export const sessionCookieName = 'red_huella_session'

export function getSessionCookieOptions(
  nodeEnvironment: 'development' | 'test' | 'production',
  expiresAt: Date,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: nodeEnvironment === 'production',
    path: '/api/v1',
    maxAge: sessionTtlSeconds * 1000,
    expires: expiresAt,
  }
}

export function getClearSessionCookieOptions(
  nodeEnvironment: 'development' | 'test' | 'production',
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: nodeEnvironment === 'production',
    path: '/api/v1',
  }
}
