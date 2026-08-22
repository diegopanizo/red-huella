import type {
  PublicationStatus,
  PublicationType,
} from '../database/schema/enums.js'

const finalStatusByType: Readonly<Record<PublicationType, PublicationStatus>> =
  {
    LOST: 'RESOLVED',
    FOUND: 'RESOLVED',
    ADOPTION: 'ADOPTED',
  }

export function canTransitionPublicationStatus(
  type: PublicationType,
  current: PublicationStatus,
  target: PublicationStatus,
): boolean {
  return (
    current === 'ACTIVE' &&
    (target === finalStatusByType[type] || target === 'ARCHIVED')
  )
}

export function resolvedAtForStatus(
  status: PublicationStatus,
  now: Date,
): Date | null {
  return status === 'RESOLVED' || status === 'ADOPTED' ? now : null
}
