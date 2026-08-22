import type { PublicationContactMethodRecord } from '../../database/schema/publication-contact-methods.js'
import type { ReplacePublicationContactMethodsInput } from '../../contacts/types.js'
import type { PublicationStatus } from '../../database/schema/enums.js'
import type { UserStatus } from '../../database/schema/enums.js'
import type { PublicationContactMethod } from '../../contacts/types.js'

export type ReplaceOwnedContactMethodsResult =
  | { outcome: 'replaced'; methods: PublicationContactMethodRecord[] }
  | { outcome: 'not_found' }
  | { outcome: 'forbidden' }
  | { outcome: 'status_not_allowed' }

export interface PublicationContactRepository {
  findByPublicationId(
    publicationId: string,
  ): Promise<PublicationContactMethodRecord[]>
  replaceAll(
    input: ReplacePublicationContactMethodsInput,
  ): Promise<PublicationContactMethodRecord[]>
  replaceAllForOwner(input: {
    publicationId: string
    ownerId: string
    methods: ReplacePublicationContactMethodsInput['methods']
    mutableStatuses: readonly PublicationStatus[]
  }): Promise<ReplaceOwnedContactMethodsResult>
  findPublicContactCandidate(publicationId: string): Promise<
    | {
        publicationStatus: PublicationStatus
        authorStatus: UserStatus
        methods: PublicationContactMethod[]
      }
    | undefined
  >
}
