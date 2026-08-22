export function roundPublicDistanceMeters(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0)
    throw new Error('Distance must be a finite non-negative number')
  const increment = distanceMeters < 10_000 ? 100 : 1_000
  return Math.round(distanceMeters / increment) * increment
}
