import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  text,
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
    thumbnailStorageKey: varchar('thumbnail_storage_key', { length: 512 }),
    mimeType: varchar('mime_type', { length: 64 }),
    displayWidth: integer('display_width'),
    displayHeight: integer('display_height'),
    displayByteSize: integer('display_byte_size'),
    displayChecksumSha256: varchar('display_checksum_sha256', { length: 64 }),
    thumbnailWidth: integer('thumbnail_width'),
    thumbnailHeight: integer('thumbnail_height'),
    thumbnailByteSize: integer('thumbnail_byte_size'),
    thumbnailChecksumSha256: varchar('thumbnail_checksum_sha256', {
      length: 64,
    }),
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
    uniqueIndex('publication_images_thumbnail_storage_key_unique').on(
      table.thumbnailStorageKey,
    ),
    check(
      'publication_images_position_non_negative',
      sql`${table.position} >= 0`,
    ),
    check(
      'publication_images_storage_key_not_blank',
      sql`length(btrim(${table.storageKey})) > 0`,
    ),
    check(
      'publication_images_thumbnail_storage_key_not_blank',
      sql`${table.thumbnailStorageKey} is null or length(btrim(${table.thumbnailStorageKey})) > 0`,
    ),
    check(
      'publication_images_normalized_mime_type',
      sql`${table.mimeType} is null or ${table.mimeType} = 'image/webp'`,
    ),
    check(
      'publication_images_display_metadata_complete',
      sql`(${table.mimeType} is null and ${table.displayWidth} is null and ${table.displayHeight} is null and ${table.displayByteSize} is null and ${table.displayChecksumSha256} is null) or (${table.mimeType} = 'image/webp' and ${table.displayWidth} is not null and ${table.displayWidth} > 0 and ${table.displayWidth} <= 2048 and ${table.displayHeight} is not null and ${table.displayHeight} > 0 and ${table.displayHeight} <= 2048 and ${table.displayByteSize} is not null and ${table.displayByteSize} > 0 and ${table.displayChecksumSha256} is not null and ${table.displayChecksumSha256} ~ '^[0-9a-f]{64}$')`,
    ),
    check(
      'publication_images_thumbnail_metadata_complete',
      sql`(${table.thumbnailStorageKey} is null and ${table.thumbnailWidth} is null and ${table.thumbnailHeight} is null and ${table.thumbnailByteSize} is null and ${table.thumbnailChecksumSha256} is null) or (${table.mimeType} = 'image/webp' and ${table.thumbnailStorageKey} is not null and ${table.thumbnailWidth} is not null and ${table.thumbnailWidth} > 0 and ${table.thumbnailWidth} <= 640 and ${table.thumbnailHeight} is not null and ${table.thumbnailHeight} > 0 and ${table.thumbnailHeight} <= 640 and ${table.thumbnailByteSize} is not null and ${table.thumbnailByteSize} > 0 and ${table.thumbnailChecksumSha256} is not null and ${table.thumbnailChecksumSha256} ~ '^[0-9a-f]{64}$')`,
    ),
  ],
)

export const storageDeletionJobs = pgTable(
  'storage_deletion_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },
  (table) => [
    index('storage_deletion_jobs_pending_idx').on(
      table.completedAt,
      table.nextAttemptAt,
    ),
    check(
      'storage_deletion_jobs_attempts_non_negative',
      sql`${table.attempts} >= 0`,
    ),
    check(
      'storage_deletion_jobs_storage_key_not_blank',
      sql`length(btrim(${table.storageKey})) > 0`,
    ),
  ],
)

export type PublicationImageRecord = typeof publicationImages.$inferSelect
export type NewPublicationImageRecord = typeof publicationImages.$inferInsert
export type StorageDeletionJobRecord = typeof storageDeletionJobs.$inferSelect
export type NewStorageDeletionJobRecord =
  typeof storageDeletionJobs.$inferInsert
