import { toContactDto } from '../contacts/dto.js'
import { ContactNotAvailableError } from '../errors/contact-errors.js'
import type { PublicationContactRepository } from '../repositories/contracts/publication-contact.repository.js'

export class GetPublicationContactService {
  constructor(private readonly contacts: PublicationContactRepository) {}

  async execute(publicationId: string) {
    const candidate =
      await this.contacts.findPublicContactCandidate(publicationId)
    if (
      !candidate ||
      candidate.publicationStatus !== 'ACTIVE' ||
      candidate.authorStatus !== 'ACTIVE' ||
      candidate.methods.length === 0
    )
      throw new ContactNotAvailableError()
    return toContactDto(candidate.methods)
  }
}
