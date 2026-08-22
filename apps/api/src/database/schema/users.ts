import { sql } from 'drizzle-orm'
import {
  check,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { userRoleEnum, userStatusEnum } from './enums.js'

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    role: userRoleEnum('role').default('USER').notNull(),
    status: userStatusEnum('status').default('ACTIVE').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', {
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
    uniqueIndex('users_email_unique').on(table.email),
    check('users_name_not_blank', sql`length(btrim(${table.name})) > 0`),
    check('users_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
)

export type UserRecord = typeof users.$inferSelect
export type NewUserRecord = typeof users.$inferInsert
