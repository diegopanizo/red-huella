import { parseCookie } from 'cookie'

import { sessionCookieName } from './cookie.js'

export function readSessionCookie(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) return undefined
  try {
    const token = parseCookie(cookieHeader)[sessionCookieName]
    return token && token.length <= 256 ? token : undefined
  } catch {
    return undefined
  }
}
