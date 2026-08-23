export const VISUAL_EMBEDDING_DIMENSIONS = 512
export const VISUAL_EMBEDDING_NORM_TOLERANCE = 1e-3

export class InvalidVisualEmbeddingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidVisualEmbeddingError'
  }
}

export function serializeVisualEmbedding(
  value: Float32Array | readonly number[],
): number[] {
  if (value.length !== VISUAL_EMBEDDING_DIMENSIONS)
    throw new InvalidVisualEmbeddingError(
      `El embedding debe contener ${VISUAL_EMBEDDING_DIMENSIONS} dimensiones`,
    )

  const serialized = Array.from(value)
  if (!serialized.every(Number.isFinite))
    throw new InvalidVisualEmbeddingError(
      'El embedding solo puede contener valores finitos',
    )

  const norm = Math.hypot(...serialized)
  if (Math.abs(norm - 1) > VISUAL_EMBEDDING_NORM_TOLERANCE)
    throw new InvalidVisualEmbeddingError(
      'El embedding debe estar normalizado con norma L2 aproximadamente 1',
    )

  return serialized
}
