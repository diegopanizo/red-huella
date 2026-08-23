import { describe, expect, it } from 'vitest'

import {
  InvalidVisualEmbeddingError,
  serializeVisualEmbedding,
  VISUAL_EMBEDDING_DIMENSIONS,
} from './embedding-vector.js'

describe('visual embedding serialization', () => {
  it('accepts a normalized Float32Array and returns a plain numeric array', () => {
    const input = new Float32Array(VISUAL_EMBEDDING_DIMENSIONS)
    input[0] = 1
    const result = serializeVisualEmbedding(input)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(512)
    expect(result[0]).toBe(1)
  })

  it.each([
    new Float32Array(511),
    Array.from({ length: 512 }, (_, index) => (index === 0 ? Number.NaN : 0)),
    Array.from({ length: 512 }, (_, index) => (index === 0 ? 2 : 0)),
  ])('rejects invalid dimensions, values, or normalization', (input) => {
    expect(() => serializeVisualEmbedding(input)).toThrow(
      InvalidVisualEmbeddingError,
    )
  })
})
