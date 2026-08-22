import type { PublicationContactMethodRecord } from '../database/schema/publication-contact-methods.js'
import type { PublicationContactMethod } from './types.js'

export function toContactDto(methods: readonly PublicationContactMethod[]) {
  return {
    methods: methods.map((method) => ({
      type: method.type,
      value: method.value,
    })),
  }
}

export function toOwnerContactSettingsDto(
  methods: readonly PublicationContactMethodRecord[],
) {
  return toContactDto(
    methods.map((method) => ({ type: method.method, value: method.value })),
  )
}

export type ContactDto = ReturnType<typeof toContactDto>

export type OwnerContactSettingsDto = ReturnType<
  typeof toOwnerContactSettingsDto
>
