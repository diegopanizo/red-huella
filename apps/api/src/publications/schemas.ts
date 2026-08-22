import { z } from 'zod'

import {
  animalSexValues,
  animalSizeValues,
  publicationStatusValues,
  publicationTypeValues,
  speciesValues,
} from '../database/schema/enums.js'

const trimmed = (maximum: number) => z.string().trim().min(1).max(maximum)
const optionalTrimmed = (maximum: number) =>
  trimmed(maximum).nullable().optional()

const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict()

export const animalInputSchema = z
  .object({
    name: optionalTrimmed(120),
    species: z.enum(speciesValues),
    breed: optionalTrimmed(120),
    sex: z.enum(animalSexValues).optional(),
    color: optionalTrimmed(120),
    size: z.enum(animalSizeValues).optional(),
    approximateAge: z.number().int().min(0).max(600).nullable().optional(),
    description: optionalTrimmed(5_000),
  })
  .strict()

export const createPublicationSchema = z
  .object({
    type: z.enum(publicationTypeValues),
    title: trimmed(160).min(5),
    description: optionalTrimmed(5_000),
    eventDate: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value)),
    location: locationSchema.nullable().optional(),
    animal: animalInputSchema,
  })
  .strict()

export const updatePublicationSchema = z
  .object({
    title: trimmed(160).min(5).optional(),
    description: optionalTrimmed(5_000),
    eventDate: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    location: locationSchema.nullable().optional(),
    animal: animalInputSchema.partial().strict().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe indicarse al menos un cambio',
  })

export const changePublicationStatusSchema = z
  .object({
    status: z
      .enum(publicationStatusValues)
      .refine((value) => value !== 'ACTIVE'),
  })
  .strict()
export const publicationIdSchema = z.object({ id: z.uuid() }).strict()

export const listPublicationsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(publicationTypeValues).optional(),
    status: z.enum(publicationStatusValues).optional(),
    species: z.enum(speciesValues).optional(),
    order: z.enum(['newest', 'oldest', 'eventDate']).default('newest'),
  })
  .strict()
