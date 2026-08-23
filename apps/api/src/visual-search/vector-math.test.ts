import { describe, expect, it } from 'vitest'

import { cosineSimilarity, normalizeL2 } from './vector-math.js'
import { VisualSearchError } from './visual-search-errors.js'

describe('normalizeL2', () => {
  it('normaliza sin mutar el vector original', () => {
    const source = new Float32Array([3, 4])
    const result = normalizeL2(source)
    expect([...result]).toEqual([0.6000000238418579, 0.800000011920929])
    expect([...source]).toEqual([3, 4])
  })

  it.each([
    new Float32Array([0, 0]),
    new Float32Array([Number.NaN]),
    new Float32Array([Number.POSITIVE_INFINITY]),
  ])('rechaza vectores nulos o no finitos', (vector) => {
    expect(() => normalizeL2(vector)).toThrow(VisualSearchError)
  })
})

describe('cosineSimilarity', () => {
  it('calcula identidad, ortogonalidad y oposición', () => {
    const x = new Float32Array([1, 0])
    expect(cosineSimilarity(x, x)).toBeCloseTo(1)
    expect(cosineSimilarity(x, new Float32Array([0, 1]))).toBeCloseTo(0)
    expect(cosineSimilarity(x, new Float32Array([-1, 0]))).toBeCloseTo(-1)
  })

  it('rechaza dimensiones distintas y valores inválidos', () => {
    expect(() =>
      cosineSimilarity(new Float32Array([1]), new Float32Array([1, 0])),
    ).toThrow(VisualSearchError)
    expect(() =>
      cosineSimilarity(new Float32Array([1]), new Float32Array([Number.NaN])),
    ).toThrow(VisualSearchError)
  })
})
