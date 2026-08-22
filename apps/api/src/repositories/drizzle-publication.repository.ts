import { and, asc, count, desc, eq, inArray, ne, type SQL } from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { animals } from '../database/schema/animals.js'
import { publicationImages } from '../database/schema/publication-images.js'
import { publications } from '../database/schema/publications.js'
import { users } from '../database/schema/users.js'
import { DatabaseError } from '../errors/app-error.js'
import type {
  CreatePublicationData,
  PublicationListQuery,
  PublicationRepository,
  UpdatePublicationData,
} from './contracts/publication.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient
const aggregateSelection = {
  publication: publications,
  animal: animals,
  author: { id: users.id, name: users.name, role: users.role },
}

export class DrizzlePublicationRepository implements PublicationRepository {
  constructor(private readonly database: DatabaseClient) {}

  findById(id: string) {
    return runDatabaseOperation(
      async () =>
        (
          await this.database
            .select()
            .from(publications)
            .where(eq(publications.id, id))
            .limit(1)
        )[0],
    )
  }
  create(data: CreatePublicationData) {
    return runDatabaseOperation(async () => {
      const [row] = await this.database
        .insert(publications)
        .values(data)
        .returning()
      if (!row)
        throw new DatabaseError(new Error('Publication insert returned no row'))
      return row
    })
  }

  createWithAnimal(
    data: Omit<CreatePublicationData, 'animalId'>,
    animalData: Parameters<PublicationRepository['createWithAnimal']>[1],
  ) {
    return runDatabaseOperation(async () => {
      const id = await this.database.transaction(async (tx) => {
        const [animal] = await tx.insert(animals).values(animalData).returning()
        if (!animal) throw new Error('Animal insert returned no row')
        const [publication] = await tx
          .insert(publications)
          .values({ ...data, animalId: animal.id })
          .returning()
        if (!publication) throw new Error('Publication insert returned no row')
        return publication.id
      })
      const result = await this.findAggregateById(id)
      if (!result) throw new Error('Created publication not found')
      return result
    })
  }

  findAggregateById(id: string) {
    return runDatabaseOperation(async () => {
      const [row] = await this.database
        .select(aggregateSelection)
        .from(publications)
        .innerJoin(animals, eq(publications.animalId, animals.id))
        .innerJoin(users, eq(publications.userId, users.id))
        .where(eq(publications.id, id))
        .limit(1)
      if (!row) return undefined
      const images = await this.database
        .select()
        .from(publicationImages)
        .where(eq(publicationImages.publicationId, id))
        .orderBy(asc(publicationImages.position))
      return { ...row, images }
    })
  }

  findMany(query: PublicationListQuery) {
    return runDatabaseOperation(async () => {
      const filters: SQL[] = []
      if (query.type) filters.push(eq(publications.type, query.type))
      if (query.status) filters.push(eq(publications.status, query.status))
      else if (!query.ownerId) filters.push(eq(publications.status, 'ACTIVE'))
      if (query.species) filters.push(eq(animals.species, query.species))
      if (query.ownerId) filters.push(eq(publications.userId, query.ownerId))
      if (!query.includeArchived)
        filters.push(ne(publications.status, 'ARCHIVED'))
      const where = filters.length ? and(...filters) : undefined
      const ordering =
        query.order === 'oldest'
          ? asc(publications.createdAt)
          : query.order === 'eventDate'
            ? desc(publications.eventDate)
            : desc(publications.createdAt)
      const rows = await this.database
        .select(aggregateSelection)
        .from(publications)
        .innerJoin(animals, eq(publications.animalId, animals.id))
        .innerJoin(users, eq(publications.userId, users.id))
        .where(where)
        .orderBy(ordering, desc(publications.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
      const [totalRow] = await this.database
        .select({ value: count() })
        .from(publications)
        .innerJoin(animals, eq(publications.animalId, animals.id))
        .where(where)
      const ids = rows.map((row) => row.publication.id)
      const imageRows = ids.length
        ? await this.database
            .select()
            .from(publicationImages)
            .where(inArray(publicationImages.publicationId, ids))
            .orderBy(asc(publicationImages.position))
        : []
      return {
        items: rows.map((row) => ({
          ...row,
          images: imageRows.filter(
            (image) => image.publicationId === row.publication.id,
          ),
        })),
        total: totalRow?.value ?? 0,
      }
    })
  }

  updateWithAnimal(
    id: string,
    publicationData: UpdatePublicationData,
    animalData: Parameters<PublicationRepository['updateWithAnimal']>[2],
  ) {
    return runDatabaseOperation(async () => {
      await this.database.transaction(async (tx) => {
        const [publication] = await tx
          .update(publications)
          .set(publicationData)
          .where(eq(publications.id, id))
          .returning()
        if (!publication) throw new Error('Publication update returned no row')
        if (animalData)
          await tx
            .update(animals)
            .set({ ...animalData, updatedAt: publicationData.updatedAt })
            .where(eq(animals.id, publication.animalId))
      })
      const result = await this.findAggregateById(id)
      if (!result) throw new Error('Updated publication not found')
      return result
    })
  }

  updateStatus(
    id: string,
    status: Parameters<PublicationRepository['updateStatus']>[1],
    resolvedAt: Date | null,
    updatedAt: Date,
  ) {
    return runDatabaseOperation(async () => {
      const [row] = await this.database
        .update(publications)
        .set({ status, resolvedAt, updatedAt })
        .where(eq(publications.id, id))
        .returning()
      if (!row) throw new Error('Publication status update returned no row')
      const result = await this.findAggregateById(id)
      if (!result) throw new Error('Updated publication not found')
      return result
    })
  }
}
