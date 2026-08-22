import { hashSessionToken } from '../auth/session-token.js'
import type { SessionRepository } from '../repositories/contracts/session.repository.js'

export class LogoutService {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(token: string | undefined, now = new Date()): Promise<void> {
    if (!token) return
    await this.sessions.revokeByTokenHash(hashSessionToken(token), now)
  }
}
