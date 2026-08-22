import { eq } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { users } from '../database/schema/users.js'
import { DatabaseError } from '../errors/app-error.js'
import type {
  CreateUserData,
  UserRepository,
} from './contracts/user.repository.js'
import { runDatabaseOperation } from './database-operation.js'
import { normalizeEmail } from './normalize-email.js'

type DatabaseClient = typeof databaseClient

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly database: DatabaseClient) {}

  findById(id: string) {
    return runDatabaseOperation(async () => {
      const [user] = await this.database
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
      return user
    })
  }

  findByEmail(email: string) {
    return runDatabaseOperation(async () => {
      const [user] = await this.database
        .select()
        .from(users)
        .where(eq(users.email, normalizeEmail(email)))
        .limit(1)
      return user
    })
  }

  create(data: CreateUserData) {
    return runDatabaseOperation(async () => {
      const [user] = await this.database
        .insert(users)
        .values({
          ...data,
          name: data.name.trim(),
          email: normalizeEmail(data.email),
        })
        .returning()

      if (!user)
        throw new DatabaseError(new Error('User insert returned no row'))
      return user
    })
  }
}
