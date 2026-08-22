import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from './api'

afterEach(() => vi.unstubAllGlobals())

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
