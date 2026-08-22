import { describe, expect, it } from 'vitest'

import {
  mapBoundsEqual,
  normalizeLongitude,
  normalizeMapBounds,
} from './map-bounds'

const bounds = (north: number, south: number, west: number, east: number) => ({
  getNorth: () => north,
  getSouth: () => south,
  getWest: () => west,
  getEast: () => east,
})

describe('map viewport bounds', () => {
  it.each([
    [0, 0],
    [180, 180],
    [-180, -180],
    [190, -170],
    [-190, 170],
    [540, 180],
  ])('normaliza longitud %s a %s', (input, expected) => {
    expect(normalizeLongitude(input)).toBe(expected)
  })

  it('produce bounds estándar y limita latitud Web Mercator', () => {
    expect(normalizeMapBounds(bounds(90, -90, -10, 10))).toEqual({
      north: 85.05112878,
      south: -85.05112878,
      west: -10,
      east: 10,
    })
  })

  it('preserva un viewport que cruza el antimeridiano', () => {
    expect(normalizeMapBounds(bounds(20, -20, 170, 190))).toEqual({
      north: 20,
      south: -20,
      west: 170,
      east: -170,
    })
  })

  it.each([
    bounds(10, 10, -5, 5),
    bounds(10, -10, 5, 5),
    bounds(10, -10, -180, 180),
    bounds(Number.NaN, -10, -5, 5),
    bounds(10, -10, -Infinity, 5),
  ])('rechaza bounds inválidos defensivamente', (value) => {
    expect(normalizeMapBounds(value)).toBeNull()
  })

  it('compara con tolerancia para ignorar ruido flotante', () => {
    const base = { north: 40, south: 30, west: -5, east: 5 }
    expect(
      mapBoundsEqual(base, {
        north: 40.000001,
        south: 29.999999,
        west: -5.000001,
        east: 5.000001,
      }),
    ).toBe(true)
    expect(mapBoundsEqual(base, { ...base, east: 5.001 })).toBe(false)
  })
})
