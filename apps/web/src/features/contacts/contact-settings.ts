import { z } from 'zod'

import type { ContactMethodType, PublicationContactMethod } from '../../types'

export type ContactSettingsFieldsValue = {
  whatsappEnabled: boolean
  whatsapp: string
  phoneEnabled: boolean
  phone: string
  emailEnabled: boolean
  email: string
}

export const emptyContactSettings: ContactSettingsFieldsValue = {
  whatsappEnabled: false,
  whatsapp: '',
  phoneEnabled: false,
  phone: '',
  emailEnabled: false,
  email: '',
}

export const normalizePhone = (value: string) => value.replace(/[ -]/g, '')

const e164 = /^\+[1-9][0-9]{7,14}$/
const email = z.string().trim().max(254).email()

export const contactSettingsFormSchema = z
  .object({
    whatsappEnabled: z.boolean(),
    whatsapp: z.string(),
    phoneEnabled: z.boolean(),
    phone: z.string(),
    emailEnabled: z.boolean(),
    email: z.string(),
  })
  .superRefine((value, context) => {
    for (const [enabled, field, label] of [
      [value.whatsappEnabled, 'whatsapp', 'WhatsApp'],
      [value.phoneEnabled, 'phone', 'Teléfono'],
    ] as const) {
      if (enabled && !e164.test(normalizePhone(value[field])))
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${label} debe incluir prefijo internacional, por ejemplo +34 600 111 222`,
        })
    }
    if (value.emailEnabled && !email.safeParse(value.email).success)
      context.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'Introduce un email válido de hasta 254 caracteres',
      })
  })

export function toContactMethods(
  value: ContactSettingsFieldsValue,
): PublicationContactMethod[] {
  const parsed = contactSettingsFormSchema.parse(value)
  const methods: PublicationContactMethod[] = []
  if (parsed.whatsappEnabled)
    methods.push({ type: 'WHATSAPP', value: normalizePhone(parsed.whatsapp) })
  if (parsed.phoneEnabled)
    methods.push({ type: 'PHONE', value: normalizePhone(parsed.phone) })
  if (parsed.emailEnabled)
    methods.push({ type: 'EMAIL', value: parsed.email.trim().toLowerCase() })
  return methods
}

export function fromContactMethods(
  methods: readonly PublicationContactMethod[],
): ContactSettingsFieldsValue {
  const get = (type: ContactMethodType) =>
    methods.find((method) => method.type === type)?.value ?? ''
  return {
    whatsappEnabled: Boolean(get('WHATSAPP')),
    whatsapp: get('WHATSAPP'),
    phoneEnabled: Boolean(get('PHONE')),
    phone: get('PHONE'),
    emailEnabled: Boolean(get('EMAIL')),
    email: get('EMAIL'),
  }
}
