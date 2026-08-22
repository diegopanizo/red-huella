import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { publications } from './publications.js'

export const publicationImages = pgTable(
  'publication_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publications.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('publication_images_publication_position_unique').on(
      table.publicationId,
      table.position,
    ),
    uniqueIndex('publication_images_storage_key_unique').on(table.storageKey),
    check(
      'publication_images_position_non_negative',
      sql`${table.position} >= 0`,
    ),
    check(
      'publication_images_storage_key_not_blank',
      sql`length(btrim(${table.storageKey})) > 0`,
    ),
  ],
)

export type PublicationImageRecord = typeof publicationImages.$inferSelect
export type NewPublicationImageRecord = typeof publicationImages.$inferInsert
