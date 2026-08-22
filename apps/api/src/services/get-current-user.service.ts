import { toPublicUser, type PublicUser } from '../auth/public-user.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import type { UserRepository } from '../repositories/contracts/user.repository.js'

export class GetCurrentUserService {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId)
    if (!user || user.status !== 'ACTIVE') throw new UnauthenticatedError()
    return toPublicUser(user)
  }
}
