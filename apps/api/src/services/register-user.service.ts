import type { PublicUser } from '../auth/public-user.js'
import { toPublicUser } from '../auth/public-user.js'
import type { PasswordHasher } from '../auth/password.js'
import { createSessionToken } from '../auth/session-token.js'
import { EmailAlreadyExistsError } from '../errors/auth-errors.js'
import type { AuthRegistrationRepository } from '../repositories/contracts/auth-registration.repository.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'
import { normalizeEmail } from '../repositories/normalize-email.js'

export interface RegisterUserCommand {
  name: string
  email: string
  password: string
}

export interface AuthenticatedUserResult {
  user: PublicUser
  token: string
  expiresAt: Date
}

export class RegisterUserService {
  constructor(
    private readonly users: UserRepository,
    private readonly registrations: AuthRegistrationRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(
    command: RegisterUserCommand,
  ): Promise<AuthenticatedUserResult> {
    const email = normalizeEmail(command.email)
    if (await this.users.findByEmail(email)) throw new EmailAlreadyExistsError()

    const passwordHash = await this.passwords.hash(command.password)
    const sessionToken = createSessionToken()
    const { user } = await this.registrations.createUserAndSession(
      {
        name: command.name,
        email,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
      },
      { tokenHash: sessionToken.tokenHash, expiresAt: sessionToken.expiresAt },
    )

    return {
      user: toPublicUser(user),
      token: sessionToken.token,
      expiresAt: sessionToken.expiresAt,
    }
  }
}
