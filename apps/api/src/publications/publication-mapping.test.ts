import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { toPublicPublicationDto } from './dto.js'
import {
  createPublicationSchema,
  listPublicationsSchema,
  updatePublicationSchema,
} from './schemas.js'

describe('publication validation, pagination and DTO', () => {
  it('applies safe pagination defaults and rejects arbitrary ordering', () => {
    expect(listPublicationsSchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      order: 'newest',
    })
    expect(listPublicationsSchema.safeParse({ pageSize: 101 }).success).toBe(
      false,
    )
    expect(listPublicationsSchema.safeParse({ order: 'title' }).success).toBe(
      false,
    )
  })

  it('rejects spoofed/protected fields in create and update', () => {
    const base = {
      type: 'LOST',
      title: 'Animal perdido',
      eventDate: '2026-08-20T10:00:00Z',
      animal: { species: 'DOG' },
    }
    expect(
      createPublicationSchema.safeParse({ ...base, userId: randomUUID() })
        .success,
    ).toBe(false)
    expect(
      updatePublicationSchema.safeParse({ status: 'ARCHIVED' }).success,
    ).toBe(false)
    expect(updatePublicationSchema.safeParse({ type: 'FOUND' }).success).toBe(
      true,
    )
  })

  it('validates complete geographic search parameters and distance ordering', () => {
    expect(
      listPublicationsSchema.safeParse({
        latitude: '40.4',
        longitude: '-3.7',
        radiusMeters: '500',
        order: 'distance',
      }).success,
    ).toBe(true)
    for (const query of [
      { latitude: '40' },
      { latitude: '40', longitude: '-3' },
      { radiusMeters: '1000' },
      { order: 'distance' },
      { latitude: 'NaN', longitude: '0', radiusMeters: '500' },
      { latitude: 'Infinity', longitude: '0', radiusMeters: '500' },
      { latitude: '91', longitude: '0', radiusMeters: '500' },
      { latitude: '0', longitude: '181', radiusMeters: '500' },
      { latitude: '0', longitude: '0', radiusMeters: '499' },
      { latitude: '0', longitude: '0', radiusMeters: '100001' },
    ])
      expect(listPublicationsSchema.safeParse(query).success).toBe(false)
  })

  it('allowlists public author and aggregate fields', () => {
    const now = new Date('2026-08-20T10:00:00Z')
    const id = randomUUID()
    const dto = toPublicPublicationDto({
      publication: {
        id,
        userId: randomUUID(),
        animalId: randomUUID(),
        type: 'LOST',
        title: 'Animal perdido',
        description: null,
        status: 'ACTIVE',
        eventDate: now,
        latitude: 40.4168,
        longitude: -3.7038,
        exactLocation: { latitude: 40.4168, longitude: -3.7038 },
        publicLocation: { latitude: 40.42, longitude: -3.71 },
        publicLocationRadiusMeters: 1_000,
        locationPrivacyVersion: 1,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      },
      animal: {
        id: randomUUID(),
        name: null,
        species: 'DOG',
        breed: null,
        sex: 'UNKNOWN',
        color: null,
        size: 'UNKNOWN',
        approximateAge: null,
        description: null,
        createdAt: now,
        updatedAt: now,
      },
      author: { id: randomUUID(), name: 'Autor', role: 'USER' },
      images: [],
    })
    expect(dto).not.toHaveProperty('userId')
    expect(dto).not.toHaveProperty('location')
    expect(dto).not.toHaveProperty('exactLocation')
    expect(dto).not.toHaveProperty('latitude')
    expect(dto).not.toHaveProperty('longitude')
    expect(dto.publicLocation).toEqual({
      latitude: 40.42,
      longitude: -3.71,
      radiusMeters: 1_000,
    })
    expect(dto.author).toEqual(expect.objectContaining({ name: 'Autor' }))
    expect(dto.author).not.toHaveProperty('email')
  })

  it('never falls back to legacy coordinates without public_location', () => {
    const now = new Date('2026-08-20T10:00:00Z')
    const dto = toPublicPublicationDto({
      publication: {
        id: randomUUID(),
        userId: randomUUID(),
        animalId: randomUUID(),
        type: 'FOUND',
        title: 'Animal encontrado',
        description: null,
        status: 'ACTIVE',
        eventDate: now,
        latitude: 41.5,
        longitude: 2.1,
        exactLocation: null,
        publicLocation: null,
        publicLocationRadiusMeters: null,
        locationPrivacyVersion: null,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      },
      animal: {
        id: randomUUID(),
        name: null,
        species: 'CAT',
        breed: null,
        sex: 'UNKNOWN',
        color: null,
        size: 'UNKNOWN',
        approximateAge: null,
        description: null,
        createdAt: now,
        updatedAt: now,
      },
      author: { id: randomUUID(), name: 'Autor', role: 'USER' },
      images: [],
    })
    expect(dto.publicLocation).toBeNull()
    expect(JSON.stringify(dto)).not.toContain('41.5')
    expect(JSON.stringify(dto)).not.toContain('2.1')
  })
})
