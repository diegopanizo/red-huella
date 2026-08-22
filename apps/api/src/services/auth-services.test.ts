import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { hashSessionToken } from '../auth/session-token.js'
import type { SessionRecord } from '../database/schema/sessions.js'
import type { UserRecord } from '../database/schema/users.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import type {
  CreateSessionData,
  SessionRepository,
} from '../repositories/contracts/session.repository.js'
import type {
  CreateUserData,
  UserRepository,
} from '../repositories/contracts/user.repository.js'
import { SessionAuthenticationService } from './session-authentication.service.js'

class StubSessions implements SessionRepository {
  constructor(private readonly result?: SessionRecord) {}
  async create(_data: CreateSessionData): Promise<SessionRecord> {
    void _data
    throw new Error('not used')
  }
  async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<SessionRecord | undefined> {
    return this.result?.tokenHash === tokenHash ? this.result : undefined
  }
  async revokeByTokenHash(): Promise<void> {}
  async deleteExpired(): Promise<number> {
    return 0
  }
}

class StubUsers implements UserRepository {
  constructor(private readonly result?: UserRecord) {}
  async findById(id: string): Promise<UserRecord | undefined> {
    return this.result?.id === id ? this.result : undefined
  }
  async findByEmail(): Promise<UserRecord | undefined> {
    return undefined
  }
  async create(_data: CreateUserData): Promise<UserRecord> {
    void _data
    throw new Error('not used')
  }
}

function fixtures(token: string, status: UserRecord['status'] = 'ACTIVE') {
  const now = new Date('2026-08-22T12:00:00Z')
  const user: UserRecord = {
    id: randomUUID(),
    name: 'User',
    email: 'user@example.test',
    passwordHash: '$argon2id$fixture',
    role: 'USER',
    status,
    emailVerifiedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  const session: SessionRecord = {
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + 60_000),
    createdAt: now,
    lastUsedAt: now,
    revokedAt: null,
  }
  return { user, session }
}

describe('SessionAuthenticationService', () => {
  it('returns a typed identity for a valid session and active user', async () => {
    const { user, session } = fixtures('valid-token')
    const service = new SessionAuthenticationService(
      new StubSessions(session),
      new StubUsers(user),
    )
    await expect(service.authenticate('valid-token')).resolves.toEqual({
      userId: user.id,
      role: 'USER',
      sessionId: session.id,
    })
  })

  it('rejects unknown, expired or revoked sessions represented as inactive by the repository', async () => {
    const service = new SessionAuthenticationService(
      new StubSessions(),
      new StubUsers(),
    )
    await expect(service.authenticate('unknown-token')).rejects.toBeInstanceOf(
      UnauthenticatedError,
    )
  })

  it('rejects a session whose user no longer exists', async () => {
    const { session } = fixtures('orphan-token')
    const service = new SessionAuthenticationService(
      new StubSessions(session),
      new StubUsers(),
    )
    await expect(service.authenticate('orphan-token')).rejects.toBeInstanceOf(
      UnauthenticatedError,
    )
  })

  it('rejects a blocked user without exposing moderation state', async () => {
    const { user, session } = fixtures('blocked-token', 'BLOCKED')
    const service = new SessionAuthenticationService(
      new StubSessions(session),
      new StubUsers(user),
    )
    await expect(service.authenticate('blocked-token')).rejects.toMatchObject({
      code: 'AUTH_UNAUTHENTICATED',
    })
  })
})
