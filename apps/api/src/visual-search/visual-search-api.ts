import { z } from 'zod'

import {
  publicationTypeValues,
  speciesValues,
  type PublicationType,
  type Species,
} from '../database/schema/enums.js'

export const visualSearchFieldsSchema = z
  .object({
    targetType: z.enum(publicationTypeValues).optional(),
    species: z.enum(speciesValues).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

export interface VisualSearchFilters {
  targetType?: PublicationType
  species?: Species
  limit: number
}

export interface SimilarPublicationRecord {
  publicationId: string
  type: PublicationType
  title: string
  eventDate: Date
  animalName: string | null
  species: Species
  breed: string | null
  primaryImageId: string | null
  matchedImageId: string
  publicLatitude: number | null
  publicLongitude: number | null
  publicLocationRadiusMeters: number | null
  visualSimilarity: number
}

export interface VisualSearchRepository {
  searchSimilarPublications(
    input: VisualSearchFilters & {
      embedding: Float32Array
      modelId: string
      modelVersion: string
    },
  ): Promise<SimilarPublicationRecord[]>
}
