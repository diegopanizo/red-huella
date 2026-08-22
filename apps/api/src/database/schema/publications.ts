import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { animals } from './animals.js'
import { publicationStatusEnum, publicationTypeEnum } from './enums.js'
import { users } from './users.js'

export const publications = pgTable(
  'publications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    animalId: uuid('animal_id')
      .notNull()
      .references(() => animals.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    type: publicationTypeEnum('type').notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    status: publicationStatusEnum('status').default('ACTIVE').notNull(),
    eventDate: timestamp('event_date', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('publications_user_id_idx').on(table.userId),
    index('publications_animal_id_idx').on(table.animalId),
    index('publications_type_idx').on(table.type),
    index('publications_status_idx').on(table.status),
    index('publications_event_date_idx').on(table.eventDate),
    index('publications_created_at_idx').on(table.createdAt),
    check(
      'publications_title_not_blank',
      sql`length(btrim(${table.title})) > 0`,
    ),
    check(
      'publications_latitude_range',
      sql`${table.latitude} is null or (${table.latitude} >= -90 and ${table.latitude} <= 90)`,
    ),
    check(
      'publications_longitude_range',
      sql`${table.longitude} is null or (${table.longitude} >= -180 and ${table.longitude} <= 180)`,
    ),
    check(
      'publications_coordinates_pair',
      sql`(${table.latitude} is null) = (${table.longitude} is null)`,
    ),
  ],
)

export type PublicationRecord = typeof publications.$inferSelect
export type NewPublicationRecord = typeof publications.$inferInsert
