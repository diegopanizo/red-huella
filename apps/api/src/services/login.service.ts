import type { PublicUser } from '../auth/public-user.js'
import { toPublicUser } from '../auth/public-user.js'
import type { PasswordHasher } from '../auth/password.js'
import { createSessionToken } from '../auth/session-token.js'
import { InvalidCredentialsError } from '../errors/auth-errors.js'
import type { SessionRepository } from '../repositories/contracts/session.repository.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'
import { normalizeEmail } from '../repositories/normalize-email.js'

export interface LoginCommand {
  email: string
  password: string
}

export interface LoginResult {
  user: PublicUser
  token: string
  expiresAt: Date
}

export class LoginService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.users.findByEmail(normalizeEmail(command.email))

    if (!user?.passwordHash) {
      await this.passwords.verifyAgainstDummy(command.password)
      throw new InvalidCredentialsError()
    }

    const passwordMatches = await this.passwords.verify(
      user.passwordHash,
      command.password,
    )
    if (!passwordMatches || user.status !== 'ACTIVE')
      throw new InvalidCredentialsError()

    const sessionToken = createSessionToken()
    await this.sessions.create({
      userId: user.id,
      tokenHash: sessionToken.tokenHash,
      expiresAt: sessionToken.expiresAt,
    })

    return {
      user: toPublicUser(user),
      token: sessionToken.token,
      expiresAt: sessionToken.expiresAt,
    }
  }
}
