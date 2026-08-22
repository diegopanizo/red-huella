import { pgEnum } from 'drizzle-orm/pg-core'

export const userRoleValues = ['USER', 'SHELTER', 'ADMIN'] as const
export const userStatusValues = ['ACTIVE', 'BLOCKED'] as const
export const speciesValues = ['DOG', 'CAT', 'OTHER'] as const
export const animalSexValues = ['MALE', 'FEMALE', 'UNKNOWN'] as const
export const animalSizeValues = ['SMALL', 'MEDIUM', 'LARGE', 'UNKNOWN'] as const
export const publicationTypeValues = ['LOST', 'FOUND', 'ADOPTION'] as const
export const publicationStatusValues = [
  'ACTIVE',
  'RESOLVED',
  'ADOPTED',
  'ARCHIVED',
] as const

export type UserRole = (typeof userRoleValues)[number]
export type UserStatus = (typeof userStatusValues)[number]
export type Species = (typeof speciesValues)[number]
export type AnimalSex = (typeof animalSexValues)[number]
export type AnimalSize = (typeof animalSizeValues)[number]
export type PublicationType = (typeof publicationTypeValues)[number]
export type PublicationStatus = (typeof publicationStatusValues)[number]

export const userRoleEnum = pgEnum('user_role', userRoleValues)
export const userStatusEnum = pgEnum('user_status', userStatusValues)
export const speciesEnum = pgEnum('species', speciesValues)
export const animalSexEnum = pgEnum('animal_sex', animalSexValues)
export const animalSizeEnum = pgEnum('animal_size', animalSizeValues)
export const publicationTypeEnum = pgEnum(
  'publication_type',
  publicationTypeValues,
)
export const publicationStatusEnum = pgEnum(
  'publication_status',
  publicationStatusValues,
)
