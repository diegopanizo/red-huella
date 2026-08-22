import type { UserRecord } from '../database/schema/users.js'

export interface PublicUser {
  id: string
  name: string
  email: string
  role: UserRecord['role']
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}
