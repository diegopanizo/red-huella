import { describe, expect, it } from 'vitest'

import { roundPublicDistanceMeters } from './public-distance.js'

describe('public distance presentation', () => {
  it.each([
    [0, 0],
    [149, 100],
    [150, 200],
    [9_949, 9_900],
    [9_999, 10_000],
    [10_000, 10_000],
    [10_499, 10_000],
    [10_500, 11_000],
  ])('rounds %s meters to %s', (input, expected) => {
    expect(roundPublicDistanceMeters(input)).toBe(expected)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid distance %s',
    (input) => {
      expect(() => roundPublicDistanceMeters(input)).toThrow()
    },
  )
})
