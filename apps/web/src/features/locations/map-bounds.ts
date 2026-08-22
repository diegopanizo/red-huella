import type { MapBounds } from '../../types'

export const MAP_BOUNDS_EPSILON = 1e-5
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878

export interface LeafletBoundsLike {
  getNorth(): number
  getSouth(): number
  getWest(): number
  getEast(): number
}

export function normalizeLongitude(value: number): number | null {
  if (!Number.isFinite(value)) return null
  const normalized = ((((value + 180) % 360) + 360) % 360) - 180
  return normalized === -180 && value > 0 ? 180 : normalized
}

export function normalizeMapBounds(
  bounds: LeafletBoundsLike,
): MapBounds | null {
  const raw = {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    west: bounds.getWest(),
    east: bounds.getEast(),
  }
  if (Object.values(raw).some((value) => !Number.isFinite(value))) return null
  if (Math.abs(raw.east - raw.west) >= 360) return null
  const north = Math.min(raw.north, WEB_MERCATOR_MAX_LATITUDE)
  const south = Math.max(raw.south, -WEB_MERCATOR_MAX_LATITUDE)
  const west = normalizeLongitude(raw.west)
  const east = normalizeLongitude(raw.east)
  if (north <= south || west === null || east === null || west === east)
    return null
  return { north, south, west, east }
}

export function mapBoundsEqual(
  left: MapBounds | null,
  right: MapBounds | null,
  epsilon = MAP_BOUNDS_EPSILON,
): boolean {
  if (left === null || right === null) return left === right
  return (['north', 'south', 'west', 'east'] as const).every(
    (key) => Math.abs(left[key] - right[key]) <= epsilon,
  )
}
