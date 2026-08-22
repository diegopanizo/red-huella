import type { PublicationRepository } from '../repositories/contracts/publication.repository.js'
import { LocationPrivacyService } from './location-privacy-policy.js'

export interface LocationBackfillResult {
  examined: number
  updated: number
  dryRun: boolean
}

export class LocationBackfillService {
  constructor(
    private readonly publications: PublicationRepository,
    private readonly privacy = new LocationPrivacyService(),
  ) {}

  async execute(options: {
    dryRun: boolean
    batchSize?: number | undefined
  }): Promise<LocationBackfillResult> {
    const batchSize = options.batchSize ?? 100
    let examined = 0
    let updated = 0
    let afterId: string | undefined

    for (;;) {
      const rows = await this.publications.findLegacyLocationsForBackfill(
        batchSize,
        afterId,
      )
      if (rows.length === 0) break

      for (const row of rows) {
        const policy = this.privacy.apply({
          type: row.type,
          location: { latitude: row.latitude, longitude: row.longitude },
          existing: {
            publicLocation: row.publicLocation,
            privacyVersion: row.locationPrivacyVersion,
          },
        })
        examined += 1
        if (!options.dryRun) {
          await this.publications.updateLocationModel(row.id, {
            exactLocation: policy.exactLocation,
            publicLocation: policy.publicLocation,
            locationPrivacyVersion: policy.privacyVersion,
            clearLegacy: true,
          })
          updated += 1
        }
      }

      afterId = rows.at(-1)?.id
      if (rows.length < batchSize) break
    }

    return { examined, updated, dryRun: options.dryRun }
  }
}
