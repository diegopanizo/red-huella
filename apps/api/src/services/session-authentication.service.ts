import { hashSessionToken } from '../auth/session-token.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import type { SessionRepository } from '../repositories/contracts/session.repository.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'

export interface AuthenticatedIdentity {
  userId: string
  role: 'USER' | 'SHELTER' | 'ADMIN'
  sessionId: string
}

export class SessionAuthenticationService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
  ) {}

  async authenticate(
    token: string,
    now = new Date(),
  ): Promise<AuthenticatedIdentity> {
    const session = await this.sessions.findActiveByTokenHash(
      hashSessionToken(token),
      now,
    )
    if (!session) throw new UnauthenticatedError()

    const user = await this.users.findById(session.userId)
    if (!user || user.status !== 'ACTIVE') throw new UnauthenticatedError()

    return { userId: user.id, role: user.role, sessionId: session.id }
  }
}
