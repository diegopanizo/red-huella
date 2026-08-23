import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('API del mapa global', () => {
  it('serializa exclusivamente bounds y filtros permitidos', async () => {
    const body = { publications: [], truncated: false, limit: 500 }
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, options?: RequestInit) => Promise<Response>
    >((input, options) => {
      void input
      void options
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      api.getMapPublications(
        { north: 44.5, south: 27.5, west: -18.5, east: 5 },
        { type: 'LOST', species: 'DOG', status: 'RESOLVED' },
      ),
    ).resolves.toEqual(body)

    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      north: '44.5',
      south: '27.5',
      west: '-18.5',
      east: '5',
      type: 'LOST',
      species: 'DOG',
      status: 'RESOLVED',
    })
    for (const forbidden of ['limit', 'page', 'pageSize', 'order', 'radius'])
      expect(requested.searchParams.has(forbidden)).toBe(false)
  })
})

describe('API de imágenes', () => {
  it('envía FormData con credentials sin establecer Content-Type', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, options?: RequestInit) => Promise<Response>
    >((input, options) => {
      void input
      void options
      return Promise.resolve(
        new Response(JSON.stringify({ images: [] }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['image'], 'pet.jpg', { type: 'image/jpeg' })

    await api.uploadPublicationImages('publication-id', [file])

    const options = fetchMock.mock.calls[0]?.[1]
    if (!options) throw new Error('Expected fetch options')
    expect(options.credentials).toBe('include')
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).getAll('images')).toEqual([file])
    expect(new Headers(options.headers).has('Content-Type')).toBe(false)
  })

  it('preserva código, mensaje y requestId de errores backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'IMAGE_TOO_MANY',
                message: 'La publicación no admite más imágenes',
                requestId: 'request-id',
              },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )

    await expect(
      api.uploadPublicationImages('publication-id', [
        new File(['x'], 'pet.webp', { type: 'image/webp' }),
      ]),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        code: 'IMAGE_TOO_MANY',
        requestId: 'request-id',
      }),
    )
  })
})

describe('API de búsqueda visual', () => {
  it('envía imagen, filtros y signal sin fijar Content-Type', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, options?: RequestInit) => Promise<Response>
    >(() =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['image'], 'pet.webp', { type: 'image/webp' })
    const controller = new AbortController()

    await api.searchPublicationsByImage(
      file,
      { targetType: 'LOST', species: 'DOG', limit: 20 },
      controller.signal,
    )

    const options = fetchMock.mock.calls[0]?.[1]
    if (!options || !(options.body instanceof FormData))
      throw new Error('Expected multipart request')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/v1/publications/search-by-image',
    )
    expect(options.credentials).toBe('include')
    expect(options.signal).toBe(controller.signal)
    expect(new Headers(options.headers).has('Content-Type')).toBe(false)
    expect(options.body.get('image')).toBe(file)
    expect(options.body.get('targetType')).toBe('LOST')
    expect(options.body.get('species')).toBe('DOG')
    expect(options.body.get('limit')).toBe('20')
  })

  it('omite filtros opcionales y conserva errores HTTP tipados', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'VISUAL_SEARCH_RATE_LIMITED',
              message: 'Too many',
              requestId: 'req-1',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['image'], 'pet.jpg', { type: 'image/jpeg' })

    await api.searchPublicationsByImage(file, { limit: 20 })
    const body = fetchMock.mock.calls[0]?.[1]?.body
    if (!(body instanceof FormData)) throw new Error('Expected FormData')
    expect(body.has('targetType')).toBe(false)
    expect(body.has('species')).toBe(false)
    await expect(
      api.searchPublicationsByImage(file, { limit: 20 }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 429,
        code: 'VISUAL_SEARCH_RATE_LIMITED',
        requestId: 'req-1',
      }),
    )
  })
})

describe('API owner de contacto', () => {
  it('lee y reemplaza ajustes con sesión y JSON', async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        void input
        void options
        return Promise.resolve(
          new Response(JSON.stringify({ contactSettings: { methods: [] } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.getPublicationContactSettings('publication-id')
    await api.replacePublicationContactSettings('publication-id', {
      methods: [{ type: 'PHONE', value: '+34600111222' }],
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/v1/publications/publication-id/contact-settings',
    )
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({
          methods: [{ type: 'PHONE', value: '+34600111222' }],
        }),
      }),
    )
  })
})

describe('API pública protegida de contacto', () => {
  it('consulta el recurso separado con credentials', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ contact: { methods: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.getPublicationContact('publication-id')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/publications/publication-id/contact',
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})
