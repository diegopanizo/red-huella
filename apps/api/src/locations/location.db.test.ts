import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { env } from '../config/index.js'
import * as schema from '../database/schema/index.js'
import { assertSafeTestDatabaseUrl } from '../database/test-database.js'
import { DrizzleAnimalRepository } from '../repositories/drizzle-animal.repository.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'
import { DrizzleUserRepository } from '../repositories/drizzle-user.repository.js'
import { distanceMeters } from './location-privacy-policy.js'
import { LocationBackfillService } from './location-backfill.service.js'

const pool = new Pool({
  connectionString: assertSafeTestDatabaseUrl(env),
  max: 2,
})
const database = drizzle({ client: pool, schema })
const users = new DrizzleUserRepository(database)
const animals = new DrizzleAnimalRepository(database)
const publications = new DrizzlePublicationRepository(database)

async function fixture(type: 'LOST' | 'FOUND' | 'ADOPTION') {
  const user = await users.create({
    name: 'Location DB User',
    email: `${randomUUID()}@location.test`,
  })
  const animal = await animals.create({ species: 'DOG' })
  return { user, animal, type }
}

beforeAll(async () => {
  await migrate(database, {
    migrationsFolder: fileURLToPath(
      new URL('../database/migrations', import.meta.url),
    ),
  })
})

afterAll(async () => {
  await pool.end()
})

describe('PostGIS publication locations', () => {
  it('uses meter-based ST_DWithin boundaries and ST_Distance', async () => {
    const result = await pool.query<{
      within499: boolean
      within501: boolean
      meters: number
    }>(`
      with points as (
        select
          ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography as origin,
          ST_Project(
            ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
            500,
            radians(90)
          ) as destination
      )
      select
        ST_DWithin(origin, destination, 499) as "within499",
        ST_DWithin(origin, destination, 501) as "within501",
        ST_Distance(origin, destination) as meters
      from points
    `)
    expect(result.rows[0]?.within499).toBe(false)
    expect(result.rows[0]?.within501).toBe(true)
    expect(Number(result.rows[0]?.meters)).toBeCloseTo(500, 3)
  })

  it('has PostGIS, geography(Point,4326), constraints and the public GiST index', async () => {
    const postgis = await pool.query<{ version: string }>(
      'select postgis_full_version() as version',
    )
    expect(postgis.rows[0]?.version).toContain('POSTGIS=')

    const columns = await pool.query<{ name: string; type: string }>(`
      select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      where c.relname = 'publications'
        and a.attname in ('exact_location', 'public_location')
        and not a.attisdropped
    `)
    expect(columns.rows).toEqual(
      expect.arrayContaining([
        { name: 'exact_location', type: 'geography(Point,4326)' },
        { name: 'public_location', type: 'geography(Point,4326)' },
      ]),
    )

    const index = await pool.query<{ indexdef: string }>(`
      select indexdef from pg_indexes
      where schemaname = 'public'
        and indexname = 'publications_public_location_gist_idx'
    `)
    expect(index.rows[0]?.indexdef.toLowerCase()).toContain('using gist')
  })

  it('roundtrips exact/public points and enforces complete public metadata', async () => {
    const { user, animal } = await fixture('LOST')
    const exactLocation = { latitude: 40.4168, longitude: -3.7038 }
    const publicLocation = {
      latitude: 40.42,
      longitude: -3.71,
      radiusMeters: 1_000,
    }
    const created = await publications.create({
      userId: user.id,
      animalId: animal.id,
      type: 'LOST',
      title: 'PostGIS roundtrip fixture',
      eventDate: new Date(),
      exactLocation,
      publicLocation,
      locationPrivacyVersion: 1,
    })
    expect(created.exactLocation).toEqual(exactLocation)
    expect(created.publicLocation).toEqual({
      latitude: publicLocation.latitude,
      longitude: publicLocation.longitude,
    })
    expect(created.publicLocationRadiusMeters).toBe(1_000)

    await expect(
      pool.query(
        `update publications
         set public_location = ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
             public_location_radius_meters = null,
             location_privacy_version = null
         where id = $1`,
        [created.id],
      ),
    ).rejects.toBeDefined()

    for (const [radius, version] of [
      [0, 1],
      [10_001, 1],
      [1_000, 0],
    ] as const) {
      await expect(
        pool.query(
          `update publications
           set public_location_radius_meters = $2,
               location_privacy_version = $3
           where id = $1`,
          [created.id, radius, version],
        ),
      ).rejects.toBeDefined()
    }
  })

  it('keeps exact-public distance inside radius and adoption exact location null', async () => {
    const lostFixture = await fixture('LOST')
    const exact = { latitude: 65, longitude: 179.999 }
    const publicPoint = { latitude: 65.004, longitude: -179.995 }
    const lost = await publications.create({
      userId: lostFixture.user.id,
      animalId: lostFixture.animal.id,
      type: 'LOST',
      title: 'Dateline distance fixture',
      eventDate: new Date(),
      exactLocation: exact,
      publicLocation: { ...publicPoint, radiusMeters: 1_000 },
      locationPrivacyVersion: 1,
    })
    const distance = await pool.query<{ meters: number }>(
      `select ST_Distance(exact_location, public_location) as meters
       from publications where id = $1`,
      [lost.id],
    )
    expect(Number(distance.rows[0]?.meters)).toBeLessThanOrEqual(1_000)
    expect(distanceMeters(exact, publicPoint)).toBeLessThanOrEqual(1_000)

    const adoptionFixture = await fixture('ADOPTION')
    const adoption = await publications.create({
      userId: adoptionFixture.user.id,
      animalId: adoptionFixture.animal.id,
      type: 'ADOPTION',
      title: 'Adoption zone fixture',
      eventDate: new Date(),
      exactLocation: null,
      publicLocation: {
        latitude: 41.4,
        longitude: 2.1,
        radiusMeters: 5_000,
      },
      locationPrivacyVersion: 1,
    })
    expect(adoption.exactLocation).toBeNull()
  })

  it('backfills legacy locations by type and is idempotent', async () => {
    const lostFixture = await fixture('LOST')
    const adoptionFixture = await fixture('ADOPTION')
    const lost = await publications.create({
      userId: lostFixture.user.id,
      animalId: lostFixture.animal.id,
      type: 'LOST',
      title: 'Legacy lost fixture',
      eventDate: new Date(),
      latitude: 0,
      longitude: 179.999,
    })
    const adoption = await publications.create({
      userId: adoptionFixture.user.id,
      animalId: adoptionFixture.animal.id,
      type: 'ADOPTION',
      title: 'Legacy adoption fixture',
      eventDate: new Date(),
      latitude: 40.4,
      longitude: -3.7,
    })

    const dryRun = await new LocationBackfillService(publications).execute({
      dryRun: true,
    })
    expect(dryRun.examined).toBeGreaterThanOrEqual(2)
    expect(dryRun.updated).toBe(0)

    const applied = await new LocationBackfillService(publications).execute({
      dryRun: false,
    })
    expect(applied.updated).toBeGreaterThanOrEqual(2)
    const lostAfter = await publications.findById(lost.id)
    const adoptionAfter = await publications.findById(adoption.id)
    expect(lostAfter?.exactLocation).not.toBeNull()
    expect(lostAfter?.publicLocationRadiusMeters).toBe(1_000)
    expect(adoptionAfter?.exactLocation).toBeNull()
    expect(adoptionAfter?.publicLocationRadiusMeters).toBe(5_000)
    expect(lostAfter?.latitude).toBeNull()
    expect(adoptionAfter?.longitude).toBeNull()

    await expect(
      new LocationBackfillService(publications).execute({ dryRun: false }),
    ).resolves.toEqual({ examined: 0, updated: 0, dryRun: false })
  })
})
