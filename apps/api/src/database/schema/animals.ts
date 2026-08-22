import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { animalSexEnum, animalSizeEnum, speciesEnum } from './enums.js'

export const animals = pgTable(
  'animals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }),
    species: speciesEnum('species').notNull(),
    breed: varchar('breed', { length: 120 }),
    sex: animalSexEnum('sex').default('UNKNOWN').notNull(),
    color: varchar('color', { length: 120 }),
    size: animalSizeEnum('size').default('UNKNOWN').notNull(),
    approximateAge: integer('approximate_age'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'animals_name_not_blank',
      sql`${table.name} is null or length(btrim(${table.name})) > 0`,
    ),
    check(
      'animals_approximate_age_non_negative',
      sql`${table.approximateAge} is null or ${table.approximateAge} >= 0`,
    ),
  ],
)

export type AnimalRecord = typeof animals.$inferSelect
export type NewAnimalRecord = typeof animals.$inferInsert
