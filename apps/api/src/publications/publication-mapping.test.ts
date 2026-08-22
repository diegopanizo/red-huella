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
      false,
    )
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
        latitude: null,
        longitude: null,
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
    expect(dto.author).toEqual(expect.objectContaining({ name: 'Autor' }))
    expect(dto.author).not.toHaveProperty('email')
  })
})
