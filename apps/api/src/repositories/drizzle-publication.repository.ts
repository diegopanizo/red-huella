import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  gt,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm'

import type { db as databaseClient } from '../database/client.js'
import { animals } from '../database/schema/animals.js'
import { publicationImages } from '../database/schema/publication-images.js'
import { publications } from '../database/schema/publications.js'
import { users } from '../database/schema/users.js'
import type { GeographyPoint } from '../database/schema/geography-point.js'
import { DatabaseError } from '../errors/app-error.js'
import type {
  CreatePublicationData,
  LocationPersistenceData,
  PublicationListQuery,
  MapPublicationQuery,
  PublicationRepository,
  UpdatePublicationData,
} from './contracts/publication.repository.js'
import { runDatabaseOperation } from './database-operation.js'

type DatabaseClient = typeof databaseClient
const aggregateSelection = {
  publication: {
    id: publications.id,
    userId: publications.userId,
    animalId: publications.animalId,
    type: publications.type,
    title: publications.title,
    description: publications.description,
    status: publications.status,
    eventDate: publications.eventDate,
    latitude: sql<number | null>`null`,
    longitude: sql<number | null>`null`,
    exactLocation: sql<GeographyPoint | null>`null`,
    publicLocation: publications.publicLocation,
    publicLocationRadiusMeters: publications.publicLocationRadiusMeters,
    locationPrivacyVersion: publications.locationPrivacyVersion,
    createdAt: publications.createdAt,
    updatedAt: publications.updatedAt,
    resolvedAt: publications.resolvedAt,
  },
  animal: animals,
  author: { id: users.id, name: users.name, role: users.role },
}

const manageAggregateSelection = {
  publication: publications,
  animal: animals,
  author: { id: users.id, name: users.name, role: users.role },
}

const MAP_FETCH_LIMIT = 501

function viewportEnvelope(
  query: MapPublicationQuery,
  west: number,
  east: number,
) {
  const envelope = sql`ST_MakeEnvelope(${west}, ${query.south}, ${east}, ${query.north}, 4326)`
  return and(
    sql`${publications.publicLocation} && (${envelope})::geography`,
    sql`ST_Covers(${envelope}, ${publications.publicLocation}::geometry)`,
  )
}

function geographicSearch(query: PublicationListQuery) {
  if (
    query.latitude === undefined ||
    query.longitude === undefined ||
    query.radiusMeters === undefined
  )
    return undefined
  const point = sql`ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography`
  return {
    point,
    radiusMeters: query.radiusMeters,
    distance:
      sql<number>`ST_Distance(${publications.publicLocation}, ${point})`.mapWith(
        Number,
      ),
  }
}

function publicationFilters(query: PublicationListQuery): SQL[] {
  const filters: SQL[] = []
  if (query.type) filters.push(eq(publications.type, query.type))
  if (query.status) filters.push(eq(publications.status, query.status))
  else if (!query.ownerId) filters.push(eq(publications.status, 'ACTIVE'))
  if (query.species) filters.push(eq(animals.species, query.species))
  if (query.ownerId) filters.push(eq(publications.userId, query.ownerId))
  if (!query.includeArchived) filters.push(ne(publications.status, 'ARCHIVED'))
  const geographic = geographicSearch(query)
  if (geographic)
    filters.push(
      sql`ST_DWithin(${publications.publicLocation}, ${geographic.point}, ${geographic.radiusMeters})`,
    )
  return filters
}

function toLocationColumns(data: {
  exactLocation?: { latitude: number; longitude: number } | null | undefined
  publicLocation?:
    | {
        latitude: number
        longitude: number
        radiusMeters: number
      }
    | null
    | undefined
  locationPrivacyVersion?: number | null | undefined
}) {
  return {
    ...(data.exactLocation !== undefined
      ? { exactLocation: data.exactLocation }
      : {}),
    ...(data.publicLocation !== undefined
      ? {
          publicLocation:
            data.publicLocation === null
              ? null
              : {
                  latitude: data.publicLocation.latitude,
                  longitude: data.publicLocation.longitude,
                },
          publicLocationRadiusMeters: data.publicLocation?.radiusMeters ?? null,
        }
      : {}),
    ...(data.locationPrivacyVersion !== undefined
      ? { locationPrivacyVersion: data.locationPrivacyVersion }
      : {}),
  }
}

function toPublicationValues<T extends CreatePublicationData>(data: T) {
  const { exactLocation, publicLocation, locationPrivacyVersion, ...rest } =
    data
  return {
    ...rest,
    ...toLocationColumns({
      exactLocation,
      publicLocation,
      locationPrivacyVersion,
    }),
  }
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
        .values(toPublicationValues(data))
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
          .values(toPublicationValues({ ...data, animalId: animal.id }))
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

  findManageAggregateById(id: string) {
    return runDatabaseOperation(async () => {
      const [row] = await this.database
        .select(manageAggregateSelection)
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
      const filters = publicationFilters(query)
      const where = filters.length ? and(...filters) : undefined
      const geographic = geographicSearch(query)
      const distanceSelection = geographic?.distance ?? sql<number | null>`null`
      const ordering =
        query.order === 'distance' && geographic
          ? geographic.distance
          : query.order === 'oldest'
            ? asc(publications.createdAt)
            : query.order === 'eventDate'
              ? desc(publications.eventDate)
              : desc(publications.createdAt)
      const rows = await this.database
        .select({ ...aggregateSelection, distanceMeters: distanceSelection })
        .from(publications)
        .innerJoin(animals, eq(publications.animalId, animals.id))
        .innerJoin(users, eq(publications.userId, users.id))
        .where(where)
        .orderBy(
          ordering,
          ...(query.order === 'distance' && geographic
            ? [desc(publications.createdAt), desc(publications.id)]
            : [desc(publications.id)]),
        )
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
          publication: row.publication,
          animal: row.animal,
          author: row.author,
          images: imageRows.filter(
            (image) => image.publicationId === row.publication.id,
          ),
          ...(geographic && row.distanceMeters !== null
            ? { distanceMeters: row.distanceMeters }
            : {}),
        })),
        total: totalRow?.value ?? 0,
      }
    })
  }

  findForMapViewport(query: MapPublicationQuery) {
    return runDatabaseOperation(async () => {
      const spatialFilter =
        query.west < query.east
          ? viewportEnvelope(query, query.west, query.east)
          : sql`(${viewportEnvelope(query, query.west, 180)}) or (${viewportEnvelope(query, -180, query.east)})`
      const rows = await this.database
        .select({
          id: publications.id,
          type: publications.type,
          status: publications.status,
          title: publications.title,
          eventDate: publications.eventDate,
          publicLocation: publications.publicLocation,
          publicLocationRadiusMeters: publications.publicLocationRadiusMeters,
          animalName: animals.name,
          species: animals.species,
          breed: animals.breed,
          thumbnailId: publicationImages.id,
          thumbnailWidth: publicationImages.thumbnailWidth,
          thumbnailHeight: publicationImages.thumbnailHeight,
        })
        .from(publications)
        .innerJoin(animals, eq(publications.animalId, animals.id))
        .leftJoin(
          publicationImages,
          and(
            eq(publicationImages.publicationId, publications.id),
            eq(publicationImages.position, 0),
          ),
        )
        .where(
          and(
            eq(publications.status, query.status),
            isNotNull(publications.publicLocation),
            isNotNull(publications.publicLocationRadiusMeters),
            ...(query.type ? [eq(publications.type, query.type)] : []),
            ...(query.species ? [eq(animals.species, query.species)] : []),
            spatialFilter,
          ),
        )
        .orderBy(desc(publications.createdAt), desc(publications.id))
        .limit(MAP_FETCH_LIMIT)

      return rows.flatMap((row) =>
        row.publicLocation === null ||
        row.publicLocationRadiusMeters === null ||
        row.status === 'ARCHIVED'
          ? []
          : [
              {
                ...row,
                status: row.status,
                publicLocation: {
                  ...row.publicLocation,
                  radiusMeters: row.publicLocationRadiusMeters,
                },
                publicLocationRadiusMeters: row.publicLocationRadiusMeters,
              },
            ],
      )
    })
  }

  updateWithAnimal(
    id: string,
    publicationData: UpdatePublicationData,
    animalData: Parameters<PublicationRepository['updateWithAnimal']>[2],
  ) {
    return runDatabaseOperation(async () => {
      const { exactLocation, publicLocation, locationPrivacyVersion, ...rest } =
        publicationData
      const values = {
        ...rest,
        ...toLocationColumns({
          exactLocation,
          publicLocation,
          locationPrivacyVersion,
        }),
      }
      await this.database.transaction(async (tx) => {
        const [publication] = await tx
          .update(publications)
          .set(values)
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

  findLegacyLocationsForBackfill(limit: number, afterId?: string) {
    return runDatabaseOperation(async () => {
      const rows = await this.database
        .select({
          id: publications.id,
          type: publications.type,
          latitude: publications.latitude,
          longitude: publications.longitude,
          publicLocation: publications.publicLocation,
          publicLocationRadiusMeters: publications.publicLocationRadiusMeters,
          locationPrivacyVersion: publications.locationPrivacyVersion,
        })
        .from(publications)
        .where(
          and(
            isNotNull(publications.latitude),
            isNotNull(publications.longitude),
            ...(afterId ? [gt(publications.id, afterId)] : []),
          ),
        )
        .orderBy(asc(publications.id))
        .limit(limit)

      return rows.map((row) => {
        if (row.latitude === null || row.longitude === null)
          throw new Error(
            'Legacy location query returned incomplete coordinates',
          )
        return {
          id: row.id,
          type: row.type,
          latitude: row.latitude,
          longitude: row.longitude,
          publicLocation:
            row.publicLocation === null ||
            row.publicLocationRadiusMeters === null
              ? null
              : {
                  ...row.publicLocation,
                  radiusMeters: row.publicLocationRadiusMeters,
                },
          locationPrivacyVersion: row.locationPrivacyVersion,
        }
      })
    })
  }

  updateLocationModel(id: string, location: LocationPersistenceData) {
    return runDatabaseOperation(async () => {
      await this.database
        .update(publications)
        .set({
          ...toLocationColumns(location),
          ...(location.clearLegacy ? { latitude: null, longitude: null } : {}),
        })
        .where(eq(publications.id, id))
    })
  }
}
