import type { PublicationType } from '../database/schema/enums.js'

export interface ExactLocation {
  latitude: number
  longitude: number
}

export interface PublicLocation {
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface LocationPrivacyPolicy {
  exactLocation: ExactLocation | null
  publicLocation: PublicLocation | null
  privacyVersion: number | null
}

export interface ExistingLocationPrivacy {
  publicLocation: PublicLocation | null
  privacyVersion: number | null
}

export interface LocationPolicyInput {
  type: PublicationType
  location: ExactLocation | null
  existing?: ExistingLocationPrivacy | undefined
}
