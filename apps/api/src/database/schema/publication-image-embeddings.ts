import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core'

import { visualEmbeddingStatusEnum } from './enums.js'
import { publicationImages } from './publication-images.js'

export const publicationImageEmbeddings = pgTable(
  'publication_image_embeddings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicationImageId: uuid('publication_image_id')
      .notNull()
      .references(() => publicationImages.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    modelId: varchar('model_id', { length: 255 }).notNull(),
    modelVersion: varchar('model_version', { length: 128 }).notNull(),
    embedding: vector('embedding', { dimensions: 512 }),
    imageChecksum: varchar('image_checksum', { length: 64 }).notNull(),
    status: visualEmbeddingStatusEnum('status').default('PENDING').notNull(),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    attemptCount: integer('attempt_count').default(0).notNull(),
    generatedAt: timestamp('generated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('publication_image_embeddings_image_model_unique').on(
      table.publicationImageId,
      table.modelId,
      table.modelVersion,
    ),
    check(
      'publication_image_embeddings_model_id_not_blank',
      sql`length(btrim(${table.modelId})) > 0`,
    ),
    check(
      'publication_image_embeddings_model_version_not_blank',
      sql`length(btrim(${table.modelVersion})) > 0`,
    ),
    check(
      'publication_image_embeddings_checksum_sha256',
      sql`${table.imageChecksum} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'publication_image_embeddings_attempt_count_non_negative',
      sql`${table.attemptCount} >= 0`,
    ),
    check(
      'publication_image_embeddings_lifecycle_consistent',
      sql`(${table.status} = 'READY' and ${table.embedding} is not null and ${table.generatedAt} is not null and ${table.lastErrorCode} is null) or (${table.status} = 'PENDING' and ${table.embedding} is null and ${table.generatedAt} is null and ${table.lastErrorCode} is null) or (${table.status} = 'FAILED' and ${table.embedding} is null and ${table.generatedAt} is null and ${table.lastErrorCode} is not null)`,
    ),
  ],
)

export type PublicationImageEmbedding =
  typeof publicationImageEmbeddings.$inferSelect
export type NewPublicationImageEmbedding =
  typeof publicationImageEmbeddings.$inferInsert
