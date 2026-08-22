import { toOwnerContactSettingsDto } from '../contacts/dto.js'
import type { PublicationContactSettings } from '../contacts/types.js'
import { ContactSettingsReadOnlyForStatusError } from '../errors/contact-errors.js'
import {
  PublicationForbiddenError,
  PublicationNotFoundError,
} from '../errors/publication-errors.js'
import type { PublicationContactRepository } from '../repositories/contracts/publication-contact.repository.js'
import type { PublicationRepository } from '../repositories/contracts/publication.repository.js'

export class GetPublicationContactSettingsService {
  constructor(
    private readonly publications: PublicationRepository,
    private readonly contacts: PublicationContactRepository,
  ) {}

  async execute(publicationId: string, ownerId: string) {
    const publication = await this.publications.findById(publicationId)
    if (!publication) throw new PublicationNotFoundError()
    if (publication.userId !== ownerId) throw new PublicationForbiddenError()
    return toOwnerContactSettingsDto(
      await this.contacts.findByPublicationId(publicationId),
    )
  }
}

export class ReplacePublicationContactSettingsService {
  constructor(private readonly contacts: PublicationContactRepository) {}

  async execute(
    publicationId: string,
    ownerId: string,
    methods: PublicationContactSettings,
  ) {
    const result = await this.contacts.replaceAllForOwner({
      publicationId,
      ownerId,
      methods,
      mutableStatuses: ['ACTIVE'],
    })
    if (result.outcome === 'not_found') throw new PublicationNotFoundError()
    if (result.outcome === 'forbidden') throw new PublicationForbiddenError()
    if (result.outcome === 'status_not_allowed')
      throw new ContactSettingsReadOnlyForStatusError()
    return toOwnerContactSettingsDto(result.methods)
  }
}
