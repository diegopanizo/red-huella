import type { UserRole, UserStatus } from '../../database/schema/enums.js'
import type { UserRecord } from '../../database/schema/users.js'

export interface CreateUserData {
  name: string
  email: string
  passwordHash?: string | null
  role?: UserRole
  status?: UserStatus
  emailVerifiedAt?: Date | null
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | undefined>
  findByEmail(email: string): Promise<UserRecord | undefined>
  create(data: CreateUserData): Promise<UserRecord>
}
