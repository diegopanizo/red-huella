import { randomBytes } from 'node:crypto'

import type { PublicationType } from '../database/schema/enums.js'
import type {
  ExactLocation,
  LocationPolicyInput,
  LocationPrivacyPolicy,
  PublicLocation,
} from './location-types.js'

export const LOCATION_PRIVACY_VERSION = 1
const EARTH_MEAN_RADIUS_METERS = 6_371_008.8
const UNIT_RANDOM_DENOMINATOR = 2 ** 48

const PUBLIC_RADIUS_BY_TYPE: Readonly<Record<PublicationType, number>> = {
  LOST: 1_000,
  FOUND: 1_500,
  ADOPTION: 5_000,
}

export interface SecureRandomSource {
  nextUnit(): number
}

export class CryptoSecureRandomSource implements SecureRandomSource {
  nextUnit(): number {
    return randomBytes(6).readUIntBE(0, 6) / UNIT_RANDOM_DENOMINATOR
  }
}

export function publicRadiusForType(type: PublicationType): number {
  return PUBLIC_RADIUS_BY_TYPE[type]
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI
}

function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180
}

export function distanceMeters(
  first: ExactLocation,
  second: ExactLocation,
): number {
  const firstLatitude = degreesToRadians(first.latitude)
  const secondLatitude = degreesToRadians(second.latitude)
  const latitudeDelta = secondLatitude - firstLatitude
  const longitudeDelta = degreesToRadians(
    normalizeLongitude(second.longitude - first.longitude),
  )
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  const boundedHaversine = Math.min(1, Math.max(0, haversine))
  const centralAngle =
    2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine))
  return EARTH_MEAN_RADIUS_METERS * centralAngle
}

function displacedLocation(
  origin: ExactLocation,
  radiusMeters: number,
  random: SecureRandomSource,
): ExactLocation {
  const radialUnit = random.nextUnit()
  const angularUnit = random.nextUnit()
  if (radialUnit < 0 || radialUnit >= 1 || angularUnit < 0 || angularUnit >= 1)
    throw new Error('Secure random source returned a value outside [0, 1)')
  const distance = Math.sqrt(radialUnit) * radiusMeters
  const bearing = 2 * Math.PI * angularUnit
  const angularDistance = distance / EARTH_MEAN_RADIUS_METERS
  const latitude = degreesToRadians(origin.latitude)
  const longitude = degreesToRadians(origin.longitude)
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(destinationLatitude),
    )

  return {
    latitude: radiansToDegrees(destinationLatitude),
    longitude: normalizeLongitude(radiansToDegrees(destinationLongitude)),
  }
}

function canKeepExistingPublicLocation(
  location: ExactLocation,
  expectedRadius: number,
  existing: LocationPolicyInput['existing'],
): existing is { publicLocation: PublicLocation; privacyVersion: number } {
  return (
    existing?.privacyVersion === LOCATION_PRIVACY_VERSION &&
    existing.publicLocation?.radiusMeters === expectedRadius &&
    distanceMeters(location, existing.publicLocation) <= expectedRadius
  )
}

export class LocationPrivacyService {
  constructor(
    private readonly random: SecureRandomSource = new CryptoSecureRandomSource(),
  ) {}

  apply(input: LocationPolicyInput): LocationPrivacyPolicy {
    if (input.location === null)
      return {
        exactLocation: null,
        publicLocation: null,
        privacyVersion: null,
      }

    const radiusMeters = publicRadiusForType(input.type)
    const center = canKeepExistingPublicLocation(
      input.location,
      radiusMeters,
      input.existing,
    )
      ? input.existing.publicLocation
      : {
          ...displacedLocation(input.location, radiusMeters, this.random),
          radiusMeters,
        }

    return {
      exactLocation: input.type === 'ADOPTION' ? null : input.location,
      publicLocation: center,
      privacyVersion: LOCATION_PRIVACY_VERSION,
    }
  }
}
