import { randomUUID } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import type { MapPublicationRecord } from '../repositories/contracts/publication.repository.js'
import {
  ListMapPublicationsService,
  MAP_PUBLICATION_LIMIT,
} from '../services/publication.services.js'

function record(index: number): MapPublicationRecord {
  return {
    id: randomUUID(),
    type: 'LOST',
    status: 'ACTIVE',
    title: `PublicaciÃ³n ${index}`,
    eventDate: new Date('2026-08-20T10:00:00Z'),
    publicLocation: { latitude: 40.4, longitude: -3.7, radiusMeters: 1_000 },
    publicLocationRadiusMeters: 1_000,
    animalName: 'Luna',
    species: 'DOG',
    breed: 'Mestizo',
    thumbnailId: index === 0 ? randomUUID() : null,
    thumbnailWidth: index === 0 ? 640 : null,
    thumbnailHeight: index === 0 ? 480 : null,
  }
}

describe('global map publication service', () => {
  it('returns only the minimal allowlisted DTO and thumbnail variant', async () => {
    const row = record(0)
    const findForMapViewport = vi.fn().mockResolvedValue([row])
    const result = await new ListMapPublicationsService({
      findForMapViewport,
    }).execute({ north: 50, south: 40, west: -5, east: 5, status: 'ACTIVE' })

    expect(result).toEqual({
      publications: [
        {
          id: row.id,
          type: 'LOST',
          status: 'ACTIVE',
          title: 'PublicaciÃ³n 0',
          eventDate: row.eventDate,
          publicLocation: { lat: 40.4, long: -3.7, radius: 1_000 },
          animal: { name: 'Luna', species: 'DOG', breed: 'Mestizo' },
          thumbnail: {
            url: `/api/v1/publication-images/${row.thumbnailId}/thumbnail`,
            width: 640,
            height: 480,
          },
        },
      ],
      truncated: false,
      limit: 500,
    })
    const serialized = JSON.stringify(result)
    for (const forbidden of [
      'description',
      'author',
      'userId',
      'exactLocation',
      'storageKey',
      'contact',
    ])
      expect(serialized).not.toContain(forbidden)
  })

  it('caps results at 500 and reports truncation without a count', async () => {
    const rows = Array.from({ length: MAP_PUBLICATION_LIMIT + 1 }, (_, index) =>
      record(index),
    )
    const result = await new ListMapPublicationsService({
      findForMapViewport: vi.fn().mockResolvedValue(rows),
    }).execute({ north: 50, south: 40, west: -5, east: 5, status: 'ACTIVE' })

    expect(result.publications).toHaveLength(500)
    expect(result.truncated).toBe(true)
    expect(result).not.toHaveProperty('total')
  })
})
