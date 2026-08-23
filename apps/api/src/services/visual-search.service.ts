import { ImageCorruptError } from '../errors/image-errors.js'
import { VisualSearchUnavailableError } from '../errors/visual-search-api-errors.js'
import type {
  VisualSearchFilters,
  VisualSearchRepository,
} from '../visual-search/visual-search-api.js'
import type { VisualEmbeddingGenerator } from '../visual-search/visual-embedding.js'
import { VisualSearchError } from '../visual-search/visual-search-errors.js'
import {
  VISUAL_MODEL_ID,
  VISUAL_MODEL_VERSION,
} from '../visual-search/visual-model.js'

export class SearchPublicationsByImageService {
  constructor(
    private readonly generator: Pick<
      VisualEmbeddingGenerator,
      'generateImageEmbeddingWithMetrics'
    >,
    private readonly repository: VisualSearchRepository,
  ) {}

  async execute(image: Buffer, filters: VisualSearchFilters) {
    try {
      const startedAt = performance.now()
      const generated =
        await this.generator.generateImageEmbeddingWithMetrics(image)
      const sqlStartedAt = performance.now()
      const records = await this.repository.searchSimilarPublications({
        ...filters,
        embedding: generated.embedding,
        modelId: VISUAL_MODEL_ID,
        modelVersion: VISUAL_MODEL_VERSION,
      })
      const sqlMs = performance.now() - sqlStartedAt
      return {
        items: records.map(toVisualSearchResultDto),
        metrics: {
          preprocessingMs: generated.preprocessingMs,
          inferenceMs: generated.inferenceMs,
          sqlMs,
          totalMs: performance.now() - startedAt,
        },
      }
    } catch (error) {
      if (error instanceof VisualSearchError) {
        if (
          error.code === 'MODEL_NOT_CONFIGURED' ||
          error.code === 'MODEL_LOAD_FAILED'
        )
          throw new VisualSearchUnavailableError()
        if (error.code === 'INVALID_IMAGE') throw new ImageCorruptError()
      }
      throw error
    }
  }
}

function toVisualSearchResultDto(
  value: Awaited<
    ReturnType<VisualSearchRepository['searchSimilarPublications']>
  >[number],
) {
  const thumbnail = (id: string | null) =>
    id === null ? null : `/api/v1/publication-images/${id}/thumbnail`
  return {
    publication: {
      id: value.publicationId,
      type: value.type,
      title: value.title,
      eventDate: value.eventDate,
      animal: {
        name: value.animalName,
        species: value.species,
        breed: value.breed,
      },
      primaryImage:
        value.primaryImageId === null
          ? null
          : {
              id: value.primaryImageId,
              thumbnailUrl: thumbnail(value.primaryImageId),
            },
      publicLocation:
        value.publicLatitude === null ||
        value.publicLongitude === null ||
        value.publicLocationRadiusMeters === null
          ? null
          : {
              latitude: value.publicLatitude,
              longitude: value.publicLongitude,
              radiusMeters: value.publicLocationRadiusMeters,
            },
    },
    matchedImage: {
      id: value.matchedImageId,
      thumbnailUrl: thumbnail(value.matchedImageId),
    },
    visualSimilarity: Number(value.visualSimilarity.toFixed(6)),
  }
}

export type VisualSearchResultDto = ReturnType<typeof toVisualSearchResultDto>
