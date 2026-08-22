import { z } from 'zod'

import { publicationContactMethodValues } from '../database/schema/enums.js'
import type {
  PublicationContactMethod,
  PublicationContactSettings,
} from './types.js'

export const e164Schema = z.string().regex(/^\+[1-9][0-9]{7,14}$/)

export const contactEmailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase())

const contactMethodSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('WHATSAPP'), value: e164Schema }).strict(),
  z.object({ type: z.literal('PHONE'), value: e164Schema }).strict(),
  z.object({ type: z.literal('EMAIL'), value: contactEmailSchema }).strict(),
])

export const publicationContactSettingsSchema = z
  .array(contactMethodSchema)
  .max(publicationContactMethodValues.length)
  .superRefine((methods, context) => {
    const seen = new Set<string>()
    for (const [index, method] of methods.entries()) {
      if (seen.has(method.type))
        context.addIssue({
          code: 'custom',
          message: 'No se puede repetir un método de contacto',
          path: [index, 'type'],
        })
      seen.add(method.type)
    }
  })

export function normalizePublicationContactSettings(
  input: readonly PublicationContactMethod[],
): PublicationContactSettings {
  return publicationContactSettingsSchema.parse(input)
}
