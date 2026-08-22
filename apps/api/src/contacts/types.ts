import type { PublicationContactMethodType } from '../database/schema/enums.js'

export type ContactMethodType = PublicationContactMethodType

export interface PublicationContactMethod {
  type: ContactMethodType
  value: string
}

export type PublicationContactSettings = readonly PublicationContactMethod[]

export interface ReplacePublicationContactMethodsInput {
  publicationId: string
  methods: PublicationContactSettings
}
