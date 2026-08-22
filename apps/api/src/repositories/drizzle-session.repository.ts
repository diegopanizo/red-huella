import { and, eq, gt, isNull, lt, or } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { sessions } from '../database/schema/sessions.js'
import { DatabaseError } from '../errors/app-error.js'
import type {
  CreateSessionData,
  SessionRepository,
} from './contracts/session.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly database: DatabaseClient) {}

  create(data: CreateSessionData) {
    return runDatabaseOperation(async () => {
      const [session] = await this.database
        .insert(sessions)
        .values(data)
        .returning()
      if (!session)
        throw new DatabaseError(new Error('Session insert returned no row'))
      return session
    })
  }

  findActiveByTokenHash(tokenHash: string, now: Date) {
    return runDatabaseOperation(async () => {
      const [session] = await this.database
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, now),
          ),
        )
        .limit(1)
      return session
    })
  }

  async revokeByTokenHash(tokenHash: string, revokedAt: Date) {
    await runDatabaseOperation(async () => {
      await this.database
        .update(sessions)
        .set({ revokedAt })
        .where(
          and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)),
        )
    })
  }

  deleteExpired(now: Date) {
    return runDatabaseOperation(async () => {
      const deleted = await this.database
        .delete(sessions)
        .where(or(lt(sessions.expiresAt, now), lt(sessions.revokedAt, now)))
        .returning({ id: sessions.id })
      return deleted.length
    })
  }
}
