import { describe, expect, it, vi } from 'vitest'

import { SearchPublicationsByImageService } from './visual-search.service.js'
import { VisualSearchError } from '../visual-search/visual-search-errors.js'
import {
  VISUAL_MODEL_ID,
  VISUAL_MODEL_VERSION,
} from '../visual-search/visual-model.js'

const embedding = Float32Array.from({ length: 512 }, (_, index) =>
  index === 0 ? 1 : 0,
)

describe('SearchPublicationsByImageService', () => {
  it('generates a transient embedding, forwards filters and maps a reduced DTO', async () => {
    const generate = vi.fn().mockResolvedValue({
      embedding,
      preprocessingMs: 3,
      inferenceMs: 12,
    })
    const search = vi.fn().mockResolvedValue([
      {
        publicationId: 'publication-1',
        type: 'FOUND',
        title: 'Perro encontrado',
        eventDate: new Date('2026-08-20T10:00:00Z'),
        animalName: 'Luna',
        species: 'DOG',
        breed: 'Mestizo',
        primaryImageId: 'primary-1',
        matchedImageId: 'matched-2',
        publicLatitude: 40.4,
        publicLongitude: -3.7,
        publicLocationRadiusMeters: 1_500,
        visualSimilarity: 0.87654321,
      },
    ])
    const service = new SearchPublicationsByImageService(
      { generateImageEmbeddingWithMetrics: generate },
      { searchSimilarPublications: search },
    )

    const result = await service.execute(Buffer.from('query-only'), {
      targetType: 'FOUND',
      species: 'DOG',
      limit: 7,
    })

    expect(generate).toHaveBeenCalledOnce()
    expect(search).toHaveBeenCalledWith({
      embedding,
      modelId: VISUAL_MODEL_ID,
      modelVersion: VISUAL_MODEL_VERSION,
      targetType: 'FOUND',
      species: 'DOG',
      limit: 7,
    })
    expect(result.items[0]).toMatchObject({
      publication: {
        id: 'publication-1',
        primaryImage: { id: 'primary-1' },
      },
      matchedImage: { id: 'matched-2' },
      visualSimilarity: 0.876543,
    })
    expect(JSON.stringify(result)).not.toMatch(
      /embedding|checksum|modelVersion|storageKey|exactLocation/,
    )
  })

  it.each(['MODEL_NOT_CONFIGURED', 'MODEL_LOAD_FAILED'] as const)(
    'maps global error %s to stable unavailable response',
    async (code) => {
      const service = new SearchPublicationsByImageService(
        {
          generateImageEmbeddingWithMetrics: vi
            .fn()
            .mockRejectedValue(new VisualSearchError(code, 'internal')),
        },
        { searchSimilarPublications: vi.fn() },
      )
      await expect(
        service.execute(Buffer.from('image'), { limit: 20 }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'VISUAL_SEARCH_UNAVAILABLE',
      })
    },
  )

  it('encapsulates invalid images without calling the repository', async () => {
    const search = vi.fn()
    const service = new SearchPublicationsByImageService(
      {
        generateImageEmbeddingWithMetrics: vi
          .fn()
          .mockRejectedValue(new VisualSearchError('INVALID_IMAGE', 'sharp')),
      },
      { searchSimilarPublications: search },
    )
    await expect(
      service.execute(Buffer.from('bad'), { limit: 20 }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'IMAGE_CORRUPT' })
    expect(search).not.toHaveBeenCalled()
  })
})
