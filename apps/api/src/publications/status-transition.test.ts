import { describe, expect, it } from 'vitest'

import {
  canTransitionPublicationStatus,
  resolvedAtForStatus,
} from './status-transition.js'

describe('publication status transitions', () => {
  it.each([
    ['LOST', 'RESOLVED'],
    ['LOST', 'ARCHIVED'],
    ['FOUND', 'RESOLVED'],
    ['FOUND', 'ARCHIVED'],
    ['ADOPTION', 'ADOPTED'],
    ['ADOPTION', 'ARCHIVED'],
  ] as const)('allows %s ACTIVE -> %s', (type, target) => {
    expect(canTransitionPublicationStatus(type, 'ACTIVE', target)).toBe(true)
  })
  it.each([
    ['LOST', 'ADOPTED'],
    ['FOUND', 'ADOPTED'],
    ['ADOPTION', 'RESOLVED'],
  ] as const)('rejects %s ACTIVE -> %s', (type, target) => {
    expect(canTransitionPublicationStatus(type, 'ACTIVE', target)).toBe(false)
  })
  it('rejects transitions from final states and timestamps only resolved/adopted', () => {
    expect(canTransitionPublicationStatus('LOST', 'RESOLVED', 'ARCHIVED')).toBe(
      false,
    )
    const now = new Date()
    expect(resolvedAtForStatus('RESOLVED', now)).toBe(now)
    expect(resolvedAtForStatus('ADOPTED', now)).toBe(now)
    expect(resolvedAtForStatus('ARCHIVED', now)).toBeNull()
  })
})
