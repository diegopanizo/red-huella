import { asc, eq, sql } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { publicationContactMethods } from '../database/schema/publication-contact-methods.js'
import { publications } from '../database/schema/publications.js'
import { users } from '../database/schema/users.js'
import { normalizePublicationContactSettings } from '../contacts/validation.js'
import type { PublicationContactRepository } from './contracts/publication-contact.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient

function isRemovalOnly(
  current: readonly { method: string; value: string }[],
  requested: readonly { type: string; value: string }[],
) {
  const currentValues = new Map(
    current.map((method) => [method.method, method.value]),
  )
  return requested.every(
    (method) => currentValues.get(method.type) === method.value,
  )
}

const methodOrder = sql<number>`case ${publicationContactMethods.method}
  when 'WHATSAPP' then 1
  when 'PHONE' then 2
  when 'EMAIL' then 3
end`

export class DrizzlePublicationContactRepository implements PublicationContactRepository {
  constructor(private readonly database: DatabaseClient) {}

  findByPublicationId(publicationId: string) {
    return runDatabaseOperation(() =>
      this.database
        .select()
        .from(publicationContactMethods)
        .where(eq(publicationContactMethods.publicationId, publicationId))
        .orderBy(asc(methodOrder)),
    )
  }

  findPublicContactCandidate(publicationId: string) {
    return runDatabaseOperation(async () => {
      const rows = await this.database
        .select({
          publicationStatus: publications.status,
          authorStatus: users.status,
          method: publicationContactMethods.method,
          value: publicationContactMethods.value,
        })
        .from(publications)
        .innerJoin(users, eq(publications.userId, users.id))
        .leftJoin(
          publicationContactMethods,
          eq(publicationContactMethods.publicationId, publications.id),
        )
        .where(eq(publications.id, publicationId))
        .orderBy(asc(methodOrder))
      const first = rows[0]
      if (!first) return undefined
      return {
        publicationStatus: first.publicationStatus,
        authorStatus: first.authorStatus,
        methods: rows.flatMap((row) =>
          row.method === null || row.value === null
            ? []
            : [{ type: row.method, value: row.value }],
        ),
      }
    })
  }

  replaceAll(input: Parameters<PublicationContactRepository['replaceAll']>[0]) {
    const methods = normalizePublicationContactSettings(input.methods)
    return runDatabaseOperation(() =>
      this.database.transaction(async (tx) => {
        await tx
          .delete(publicationContactMethods)
          .where(
            eq(publicationContactMethods.publicationId, input.publicationId),
          )
        if (methods.length > 0)
          await tx.insert(publicationContactMethods).values(
            methods.map((method) => ({
              publicationId: input.publicationId,
              method: method.type,
              value: method.value,
            })),
          )
        return tx
          .select()
          .from(publicationContactMethods)
          .where(
            eq(publicationContactMethods.publicationId, input.publicationId),
          )
          .orderBy(asc(methodOrder))
      }),
    )
  }

  replaceAllForOwner(
    input: Parameters<PublicationContactRepository['replaceAllForOwner']>[0],
  ) {
    const methods = normalizePublicationContactSettings(input.methods)
    return runDatabaseOperation(() =>
      this.database.transaction(async (tx) => {
        const [publication] = await tx
          .select({
            ownerId: publications.userId,
            status: publications.status,
          })
          .from(publications)
          .where(eq(publications.id, input.publicationId))
          .for('update')
          .limit(1)
        if (!publication) return { outcome: 'not_found' as const }
        if (publication.ownerId !== input.ownerId)
          return { outcome: 'forbidden' as const }

        const current = await tx
          .select()
          .from(publicationContactMethods)
          .where(
            eq(publicationContactMethods.publicationId, input.publicationId),
          )
        if (
          !input.mutableStatuses.includes(publication.status) &&
          !isRemovalOnly(current, methods)
        )
          return { outcome: 'status_not_allowed' as const }

        await tx
          .delete(publicationContactMethods)
          .where(
            eq(publicationContactMethods.publicationId, input.publicationId),
          )
        if (methods.length > 0)
          await tx.insert(publicationContactMethods).values(
            methods.map((method) => ({
              publicationId: input.publicationId,
              method: method.type,
              value: method.value,
            })),
          )
        const result = await tx
          .select()
          .from(publicationContactMethods)
          .where(
            eq(publicationContactMethods.publicationId, input.publicationId),
          )
          .orderBy(asc(methodOrder))
        return { outcome: 'replaced' as const, methods: result }
      }),
    )
  }
}
