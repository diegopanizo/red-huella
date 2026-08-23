import { VisualSearchError } from './visual-search-errors.js'

function assertFiniteVector(vector: Float32Array, label: string): void {
  if (vector.length === 0)
    throw new VisualSearchError('INVALID_MODEL_OUTPUT', `${label} está vacío`)
  for (const value of vector) {
    if (!Number.isFinite(value))
      throw new VisualSearchError(
        'INVALID_MODEL_OUTPUT',
        `${label} contiene valores no finitos`,
      )
  }
}

export function normalizeL2(vector: Float32Array): Float32Array {
  assertFiniteVector(vector, 'El vector')
  let squaredNorm = 0
  for (const value of vector) squaredNorm += value * value
  const norm = Math.sqrt(squaredNorm)
  if (!Number.isFinite(norm) || norm === 0)
    throw new VisualSearchError(
      'INVALID_MODEL_OUTPUT',
      'No se puede normalizar un vector nulo',
    )
  const normalized = new Float32Array(vector.length)
  for (let index = 0; index < vector.length; index += 1)
    normalized[index] = vector[index]! / norm
  return normalized
}

export function cosineSimilarity(
  left: Float32Array,
  right: Float32Array,
): number {
  assertFiniteVector(left, 'El vector izquierdo')
  assertFiniteVector(right, 'El vector derecho')
  if (left.length !== right.length)
    throw new VisualSearchError(
      'INVALID_MODEL_OUTPUT',
      'Los vectores deben tener la misma dimensión',
    )
  let dot = 0
  let leftSquaredNorm = 0
  let rightSquaredNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!
    const rightValue = right[index]!
    dot += leftValue * rightValue
    leftSquaredNorm += leftValue * leftValue
    rightSquaredNorm += rightValue * rightValue
  }
  const denominator = Math.sqrt(leftSquaredNorm * rightSquaredNorm)
  if (!Number.isFinite(denominator) || denominator === 0)
    throw new VisualSearchError(
      'INVALID_MODEL_OUTPUT',
      'No se puede comparar un vector nulo',
    )
  return Math.max(-1, Math.min(1, dot / denominator))
}
