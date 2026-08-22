import { sql } from 'drizzle-orm'
import {
  check,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { publicationContactMethodEnum } from './enums.js'
import { publications } from './publications.js'

export const publicationContactMethods = pgTable(
  'publication_contact_methods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publications.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    method: publicationContactMethodEnum('method').notNull(),
    value: varchar('value', { length: 320 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('publication_contact_methods_publication_method_unique').on(
      table.publicationId,
      table.method,
    ),
    check(
      'publication_contact_methods_value_trimmed',
      sql`${table.value} = btrim(${table.value})`,
    ),
    check(
      'publication_contact_methods_value_not_empty',
      sql`length(${table.value}) > 0`,
    ),
    check(
      'publication_contact_methods_email_length',
      sql`${table.method} <> 'EMAIL' or length(${table.value}) <= 254`,
    ),
    check(
      'publication_contact_methods_phone_e164',
      sql`${table.method} not in ('PHONE', 'WHATSAPP') or ${table.value} ~ '^[+][1-9][0-9]{7,14}$'`,
    ),
  ],
)

export type PublicationContactMethodRecord =
  typeof publicationContactMethods.$inferSelect
export type NewPublicationContactMethodRecord =
  typeof publicationContactMethods.$inferInsert
