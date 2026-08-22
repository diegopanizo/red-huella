import { describe, expect, it, vi } from 'vitest'

import {
  distanceMeters,
  LOCATION_PRIVACY_VERSION,
  LocationPrivacyService,
  publicRadiusForType,
  type SecureRandomSource,
} from './location-privacy-policy.js'

class SequenceRandom implements SecureRandomSource {
  private index = 0
  constructor(private readonly values: number[]) {}
  nextUnit(): number {
    const value = this.values[this.index % this.values.length]
    this.index += 1
    if (value === undefined) throw new Error('Missing random fixture')
    return value
  }
}

describe('location privacy policy v1', () => {
  it('defines the approved radius for every publication type', () => {
    expect(publicRadiusForType('LOST')).toBe(1_000)
    expect(publicRadiusForType('FOUND')).toBe(1_500)
    expect(publicRadiusForType('ADOPTION')).toBe(5_000)
  })

  it.each([
    ['LOST', 0, 0],
    ['FOUND', 65, 20],
    ['LOST', 10, 179.999],
    ['FOUND', -10, -179.999],
  ] as const)(
    '%s preserves exact location and keeps it inside the public circle at %s,%s',
    (type, latitude, longitude) => {
      const exact = { latitude, longitude }
      const result = new LocationPrivacyService(
        new SequenceRandom([0.999_999, 0.375]),
      ).apply({ type, location: exact })
      expect(result.exactLocation).toEqual(exact)
      expect(result.privacyVersion).toBe(LOCATION_PRIVACY_VERSION)
      expect(result.publicLocation).not.toBeNull()
      if (!result.publicLocation) throw new Error('Expected public location')
      expect(distanceMeters(exact, result.publicLocation)).toBeLessThanOrEqual(
        result.publicLocation.radiusMeters + 0.001,
      )
      expect(result.publicLocation.longitude).toBeGreaterThanOrEqual(-180)
      expect(result.publicLocation.longitude).toBeLessThanOrEqual(180)
    },
  )

  it('never stores an exact adoption location', () => {
    const result = new LocationPrivacyService(
      new SequenceRandom([0.25, 0.5]),
    ).apply({
      type: 'ADOPTION',
      location: { latitude: 40.4, longitude: -3.7 },
    })
    expect(result.exactLocation).toBeNull()
    expect(result.publicLocation?.radiusMeters).toBe(5_000)
    expect(result.privacyVersion).toBe(1)
  })

  it('uses the injected secure source and never Math.random', () => {
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used')
    })
    expect(() =>
      new LocationPrivacyService(new SequenceRandom([0.25, 0.5])).apply({
        type: 'LOST',
        location: { latitude: 0, longitude: 0 },
      }),
    ).not.toThrow()
    expect(mathRandom).not.toHaveBeenCalled()
    mathRandom.mockRestore()
  })

  it('keeps a compatible public circle when the edited exact point remains inside', () => {
    const existing = {
      publicLocation: { latitude: 40, longitude: -3, radiusMeters: 1_000 },
      privacyVersion: 1,
    }
    const result = new LocationPrivacyService(
      new SequenceRandom([0.5, 0.5]),
    ).apply({
      type: 'LOST',
      location: { latitude: 40.001, longitude: -3 },
      existing,
    })
    expect(result.publicLocation).toBe(existing.publicLocation)
  })

  it('regenerates the public circle when the edited exact point is outside', () => {
    const existing = {
      publicLocation: { latitude: 40, longitude: -3, radiusMeters: 1_000 },
      privacyVersion: 1,
    }
    const result = new LocationPrivacyService(
      new SequenceRandom([0.25, 0.25]),
    ).apply({
      type: 'LOST',
      location: { latitude: 41, longitude: -3 },
      existing,
    })
    expect(result.publicLocation).not.toBe(existing.publicLocation)
    expect(result.publicLocation).not.toEqual(existing.publicLocation)
  })

  it('clears every location field when location is removed', () => {
    expect(
      new LocationPrivacyService(new SequenceRandom([0, 0])).apply({
        type: 'FOUND',
        location: null,
      }),
    ).toEqual({
      exactLocation: null,
      publicLocation: null,
      privacyVersion: null,
    })
  })
})
