import { eq } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { animals } from '../database/schema/animals.js'
import { DatabaseError } from '../errors/app-error.js'
import type {
  AnimalRepository,
  CreateAnimalData,
} from './contracts/animal.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient

export class DrizzleAnimalRepository implements AnimalRepository {
  constructor(private readonly database: DatabaseClient) {}

  findById(id: string) {
    return runDatabaseOperation(async () => {
      const [animal] = await this.database
        .select()
        .from(animals)
        .where(eq(animals.id, id))
        .limit(1)
      return animal
    })
  }

  create(data: CreateAnimalData) {
    return runDatabaseOperation(async () => {
      const [animal] = await this.database
        .insert(animals)
        .values(data)
        .returning()
      if (!animal)
        throw new DatabaseError(new Error('Animal insert returned no row'))
      return animal
    })
  }
}
