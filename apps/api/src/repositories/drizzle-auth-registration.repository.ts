import type { db as databaseClient } from '../database/client.js'
import { sessions } from '../database/schema/sessions.js'
import { users } from '../database/schema/users.js'
import { DatabaseError } from '../errors/app-error.js'
import { EmailAlreadyExistsError } from '../errors/auth-errors.js'
import type {
  AuthRegistrationRepository,
  RegistrationSessionData,
} from './contracts/auth-registration.repository.js'
import type { CreateUserData } from './contracts/user.repository.js'
import { normalizeEmail } from './normalize-email.js'
import { isUniqueEmailViolation } from './postgres-errors.js'

type DatabaseClient = typeof databaseClient

export class DrizzleAuthRegistrationRepository implements AuthRegistrationRepository {
  constructor(private readonly database: DatabaseClient) {}

  async createUserAndSession(
    userData: CreateUserData,
    sessionData: RegistrationSessionData,
  ) {
    try {
      return await this.database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({
            ...userData,
            name: userData.name.trim(),
            email: normalizeEmail(userData.email),
          })
          .returning()
        if (!user) throw new Error('User insert returned no row')

        const [session] = await transaction
          .insert(sessions)
          .values({ ...sessionData, userId: user.id })
          .returning()
        if (!session) throw new Error('Session insert returned no row')

        return { user, session }
      })
    } catch (error: unknown) {
      if (isUniqueEmailViolation(error)) throw new EmailAlreadyExistsError()
      throw new DatabaseError(error)
    }
  }
}
