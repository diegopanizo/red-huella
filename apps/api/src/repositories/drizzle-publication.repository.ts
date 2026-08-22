import { eq } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { publications } from '../database/schema/publications.js'
import { DatabaseError } from '../errors/app-error.js'
import type {
  CreatePublicationData,
  PublicationRepository,
} from './contracts/publication.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient

export class DrizzlePublicationRepository implements PublicationRepository {
  constructor(private readonly database: DatabaseClient) {}

  findById(id: string) {
    return runDatabaseOperation(async () => {
      const [publication] = await this.database
        .select()
        .from(publications)
        .where(eq(publications.id, id))
        .limit(1)
      return publication
    })
  }

  create(data: CreatePublicationData) {
    return runDatabaseOperation(async () => {
      const [publication] = await this.database
        .insert(publications)
        .values(data)
        .returning()
      if (!publication)
        throw new DatabaseError(new Error('Publication insert returned no row'))
      return publication
    })
  }
}
