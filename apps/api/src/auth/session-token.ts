import { createHash, randomBytes } from 'node:crypto'

export const sessionTtlSeconds = 7 * 24 * 60 * 60

export interface SessionToken {
  token: string
  tokenHash: string
  expiresAt: Date
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createSessionToken(now = new Date()): SessionToken {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + sessionTtlSeconds * 1000),
  }
}
