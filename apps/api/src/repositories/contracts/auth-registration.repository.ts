import type { SessionRecord } from '../../database/schema/sessions.js'
import type { UserRecord } from '../../database/schema/users.js'
import type { CreateUserData } from './user.repository.js'

export interface RegistrationSessionData {
  tokenHash: string
  expiresAt: Date
}

export interface AuthRegistrationRepository {
  createUserAndSession(
    user: CreateUserData,
    session: RegistrationSessionData,
  ): Promise<{ user: UserRecord; session: SessionRecord }>
}
