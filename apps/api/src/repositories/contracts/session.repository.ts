import type { SessionRecord } from '../../database/schema/sessions.js'

export interface CreateSessionData {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export interface SessionRepository {
  create(data: CreateSessionData): Promise<SessionRecord>
  findActiveByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<SessionRecord | undefined>
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>
  deleteExpired(now: Date): Promise<number>
}
