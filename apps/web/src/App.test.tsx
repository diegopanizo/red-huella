import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { AuthProvider } from './features/auth/AuthProvider'

vi.mock('./features/locations/LocationMap', () => ({
  LocationMap: ({
    onChange,
  }: {
    onChange: (value: { latitude: number; longitude: number }) => void
  }) => (
    <button
      type="button"
      onClick={() => onChange({ latitude: 40.4168, longitude: -3.7038 })}
    >
      Seleccionar punto del mapa
    </button>
  ),
}))
vi.mock('./features/locations/PublicLocationMap', () => ({
  PublicLocationMap: ({
    publicLocation,
    type,
  }: {
    publicLocation: { radiusMeters: number }
    type: string
  }) => (
    <div
      data-testid="public-location-map"
      data-radius={publicLocation.radiusMeters}
    >
      Mapa público {type}
    </div>
  ),
}))

const publication = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'LOST',
  title: 'Se busca a Rocky',
  description: 'Perro marrón',
  status: 'ACTIVE',
  eventDate: '2026-08-20T10:00:00Z',
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
  resolvedAt: null,
  publicLocation: null,
  animal: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Rocky',
    species: 'DOG',
    breed: null,
    sex: 'MALE',
    color: 'Marrón',
    size: 'MEDIUM',
    approximateAge: 24,
    description: null,
  },
  author: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Diego',
    role: 'USER',
  },
  images: [],
}

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}
function renderApp(path = '/') {
  window.history.pushState({}, '', path)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  URL.createObjectURL = vi.fn((file: File) => `blob:${file.name}`)
  URL.revokeObjectURL = vi.fn()
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: undefined,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('frontend funcional', () => {
  it('muestra loading y después publicaciones con placeholder y enlace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/me')
          ? json(
              {
                error: {
                  code: 'AUTH_UNAUTHENTICATED',
                  message: 'No autenticado',
                },
              },
              401,
            )
          : json({
              items: [publication],
              pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            }),
      ),
    )
    renderApp()
    expect(screen.getAllByText('Cargando…').length).toBeGreaterThan(0)
    expect(await screen.findByRole('link', { name: 'Rocky' })).toHaveAttribute(
      'href',
      `/publications/${publication.id}`,
    )
    expect(screen.getByLabelText('Imagen no disponible')).toBeInTheDocument()
    expect(screen.getByText('Perdido')).toBeInTheDocument()
    expect(screen.getByText('Perdido · Perro')).toBeInTheDocument()
    expect(screen.queryByText(/Border Collie/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Zona aproximada protegida/),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Aprox\./)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'LOST' },
    })
    await waitFor(() => expect(window.location.search).toContain('type=LOST'))
  })

  it('resume raza, sexo y geografía pública sin mostrar coordenadas', async () => {
    const located = {
      ...publication,
      publicLocation: {
        latitude: 40.4168,
        longitude: -3.7038,
        radiusMeters: 1_000,
      },
      distanceMeters: 2_300,
      animal: { ...publication.animal, breed: 'Border Collie' },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/me')
          ? json({}, 401)
          : json({
              items: [located],
              pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            }),
      ),
    )
    renderApp()
    expect(
      await screen.findByText('Perdido · Perro · Border Collie'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Macho/)).toBeInTheDocument()
    expect(screen.getByText('Zona aproximada protegida')).toBeInTheDocument()
    expect(screen.getByText('Cerca de ti · Aprox. 2,3 km')).toBeInTheDocument()
    expect(screen.queryByText(/40[.,]4168/)).not.toBeInTheDocument()
    expect(screen.queryByText(/-3[.,]7038/)).not.toBeInTheDocument()
    expect(screen.queryByText(/1\.000 m/)).not.toBeInTheDocument()
  })

  it('busca cerca solo tras click, conserva filtros, cambia radio y permite quitarla', async () => {
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })
    const requestedUrls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/me')) return json({}, 401)
        requestedUrls.push(url)
        return json({
          items: [publication],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        })
      }),
    )
    renderApp()
    await screen.findByRole('link', { name: 'Rocky' })
    expect(getCurrentPosition).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar cerca de mí' }))
    expect(getCurrentPosition).toHaveBeenCalledOnce()
    const [success, , options] = getCurrentPosition.mock.calls[0]!
    expect(options).toMatchObject({
      enableHighAccuracy: false,
      timeout: 10_000,
    })
    success({ coords: { latitude: 40.4, longitude: -3.7 } })
    await waitFor(() =>
      expect(
        requestedUrls.some(
          (url) =>
            url.includes('latitude=40.4') &&
            url.includes('longitude=-3.7') &&
            url.includes('radiusMeters=25000') &&
            url.includes('order=distance'),
        ),
      ).toBe(true),
    )
    expect(screen.getByText('Ordenadas por cercanía')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Especie'), {
      target: { value: 'DOG' },
    })
    await waitFor(() =>
      expect(
        requestedUrls.some(
          (url) => url.includes('species=DOG') && url.includes('latitude=40.4'),
        ),
      ).toBe(true),
    )
    fireEvent.change(screen.getByLabelText('Radio de búsqueda'), {
      target: { value: '5000' },
    })
    await waitFor(() =>
      expect(
        requestedUrls.some(
          (url) =>
            url.includes('radiusMeters=5000') && url.includes('species=DOG'),
        ),
      ).toBe(true),
    )
    expect(getCurrentPosition).toHaveBeenCalledOnce()
    fireEvent.click(
      screen.getByRole('button', { name: 'Quitar búsqueda por cercanía' }),
    )
    await waitFor(() => {
      const last = requestedUrls.at(-1) ?? ''
      expect(last).toContain('species=DOG')
      expect(last).not.toContain('latitude=')
      expect(last).not.toContain('order=distance')
    })
  })

  it.each([
    [1, 'Permiso de ubicación denegado'],
    [2, 'No se pudo obtener tu ubicación'],
    [3, 'La geolocalización tardó demasiado'],
  ])(
    'mantiene el listado ante el error de geolocalización %s',
    async (code, message) => {
      const getCurrentPosition = vi.fn()
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition },
      })
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) =>
          String(input).includes('/auth/me')
            ? json({}, 401)
            : json({
                items: [publication],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
              }),
        ),
      )
      renderApp()
      await screen.findByRole('link', { name: 'Rocky' })
      fireEvent.click(
        screen.getByRole('button', { name: 'Buscar cerca de mí' }),
      )
      getCurrentPosition.mock.calls[0]![1]({ code })
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.getByRole('link', { name: 'Rocky' })).toBeInTheDocument()
    },
  )

  it('deshabilita cercanía sin API de geolocalización', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/me')
          ? json({}, 401)
          : json({
              items: [publication],
              pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            }),
      ),
    )
    renderApp()
    await screen.findByRole('link', { name: 'Rocky' })
    expect(
      screen.getByRole('button', { name: 'Búsqueda cercana no disponible' }),
    ).toBeDisabled()
  })

  it('muestra mapa público, raza y sexo en detalle sin coordenadas exactas', async () => {
    const located = {
      ...publication,
      publicLocation: {
        latitude: 40.4168,
        longitude: -3.7038,
        radiusMeters: 1_000,
      },
      animal: { ...publication.animal, breed: 'Border Collie' },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/me')
          ? json({}, 401)
          : json({ publication: located }),
      ),
    )
    renderApp(`/publications/${publication.id}`)
    expect(await screen.findByTestId('public-location-map')).toHaveAttribute(
      'data-radius',
      '1000',
    )
    expect(screen.getByText('Border Collie')).toBeInTheDocument()
    expect(screen.getByText('Macho')).toBeInTheDocument()
    expect(screen.queryByText(/40[.,]4168/)).not.toBeInTheDocument()
    expect(screen.queryByText(/exactLocation/)).not.toBeInTheDocument()
  })

  it('omite el mapa público en detalle sin publicLocation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/me')
          ? json({}, 401)
          : json({ publication }),
      ),
    )
    renderApp(`/publications/${publication.id}`)
    await screen.findByRole('heading', { name: publication.title })
    expect(screen.queryByTestId('public-location-map')).not.toBeInTheDocument()
  })

  it('muestra estado vacío', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/me')
          ? json({}, 401)
          : json({
              items: [],
              pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
            }),
      ),
    )
    renderApp()
    expect(
      await screen.findByText('No hay publicaciones con estos filtros.'),
    ).toBeInTheDocument()
  })

  it('muestra el thumbnail principal en cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/me')
          ? json({}, 401)
          : json({
              items: [
                {
                  ...publication,
                  images: [
                    {
                      id: 'image-id',
                      position: 0,
                      url: '/api/v1/publication-images/image-id/content',
                      thumbnailUrl:
                        '/api/v1/publication-images/image-id/thumbnail',
                      width: 1200,
                      height: 800,
                    },
                  ],
                },
              ],
              pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            }),
      ),
    )
    renderApp()
    const image = await screen.findByAltText('Imagen de Rocky')
    expect(image).toHaveAttribute(
      'src',
      'http://localhost:3000/api/v1/publication-images/image-id/thumbnail',
    )
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(
      screen.queryByLabelText('Imagen no disponible'),
    ).not.toBeInTheDocument()
  })

  it('redirige una ruta protegida al login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({}, 401)),
    )
    renderApp('/my-publications')
    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument()
  })

  it('valida el registro sin enviar credenciales inválidas', async () => {
    const fetchMock = vi.fn(() => json({}, 401))
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/register')
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'persona@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'muy corta' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText('Mínimo 12 caracteres')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('envía login, actualiza /me y vuelve al inicio', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).includes('/auth/login')
        ? json({
            user: {
              id: 'user-id',
              name: 'Ana',
              email: 'ana@example.test',
              role: 'USER',
            },
          })
        : String(input).includes('/auth/me')
          ? json({}, 401)
          : json({
              items: [],
              pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
            }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/login')
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ana@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'una contraseña segura' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    )
  })

  it('crea JSON antes de multipart y reintenta upload sin duplicar publicación', async () => {
    let uploadAttempts = 0
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input)
        if (url.includes('/auth/me'))
          return json({
            user: {
              id: publication.author.id,
              name: 'Diego',
              email: 'diego@example.test',
              role: 'USER',
            },
          })
        if (url.endsWith('/publications') && options?.method === 'POST')
          return json({ publication }, 201)
        if (url.endsWith(`/publications/${publication.id}/images`)) {
          uploadAttempts += 1
          return uploadAttempts === 1
            ? json(
                {
                  error: {
                    code: 'STORAGE_OPERATION_FAILED',
                    message: 'No se pudieron guardar las imágenes',
                  },
                },
                503,
              )
            : json({ images: [] }, 201)
        }
        if (url.endsWith(`/publications/${publication.id}`))
          return json({ publication })
        return json({
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/publications/new')

    await screen.findByRole('heading', { name: 'Publica una huella' })
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Se busca a Rocky' },
    })
    fireEvent.change(screen.getByLabelText('Fecha y hora'), {
      target: { value: '2026-08-20T10:00' },
    })
    fireEvent.change(screen.getByLabelText('Seleccionar imágenes'), {
      target: {
        files: [new File(['image'], 'rocky.jpg', { type: 'image/jpeg' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar publicación' }))

    expect(
      await screen.findByText('La publicación se ha creado.'),
    ).toBeInTheDocument()
    const createCalls = () =>
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          String(url).endsWith('/publications') &&
          (options as RequestInit | undefined)?.method === 'POST',
      )
    expect(createCalls()).toHaveLength(1)
    expect(uploadAttempts).toBe(1)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Reintentar imágenes' })[0]!,
    )
    await waitFor(() =>
      expect(window.location.pathname).toBe(`/publications/${publication.id}`),
    )
    expect(createCalls()).toHaveLength(1)
    expect(uploadAttempts).toBe(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:rocky.jpg')
    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(`/publications/${publication.id}/images`),
    )
    expect((uploadCall?.[1] as RequestInit).body).toBeInstanceOf(FormData)
  })

  it('recupera desde mine el detalle archived propio y solo ofrece eliminar imágenes', async () => {
    const archived = {
      ...publication,
      status: 'ARCHIVED',
      images: [
        {
          id: 'archived-image',
          position: 0,
          url: '/api/v1/publication-images/archived-image/content',
          thumbnailUrl: '/api/v1/publication-images/archived-image/thumbnail',
          width: 1200,
          height: 800,
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/me'))
          return json({
            user: {
              id: publication.author.id,
              name: 'Diego',
              email: 'diego@example.test',
              role: 'USER',
            },
          })
        if (url.includes('/publications/mine'))
          return json({
            items: [archived],
            pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          })
        return json(
          {
            error: { code: 'PUBLICATION_NOT_FOUND', message: 'No encontrada' },
          },
          404,
        )
      }),
    )
    renderApp(`/publications/${publication.id}`)

    expect(
      await screen.findByRole('heading', { name: 'Gestionar imágenes' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Seleccionar imágenes'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hacer principal' }),
    ).not.toBeInTheDocument()
  })

  it('crea con la ubicación seleccionada y cambia los textos de privacidad', async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input)
        if (url.includes('/auth/me'))
          return json({
            user: { ...publication.author, email: 'diego@example.test' },
          })
        if (url.endsWith('/publications') && options?.method === 'POST')
          return json({ publication }, 201)
        return json({
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/publications/new')
    await screen.findByRole('heading', { name: 'Publica una huella' })
    expect(screen.getByText(/zona aproximada de 1 km/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'FOUND' },
    })
    expect(screen.getByText(/zona aproximada de 1,5 km/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'ADOPTION' },
    })
    expect(
      screen.getByText(/No publiques tu domicilio exacto/),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Seleccionar punto del mapa' }),
    )
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Adopción responsable' },
    })
    fireEvent.change(screen.getByLabelText('Fecha y hora'), {
      target: { value: '2026-08-20T10:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar publicación' }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, options]) => {
          if (
            !String(url).endsWith('/publications') ||
            (options as RequestInit | undefined)?.method !== 'POST'
          )
            return false
          const body = JSON.parse(String((options as RequestInit).body))
          return body.location.latitude === 40.4168 && body.type === 'ADOPTION'
        }),
      ).toBe(true),
    )
  })

  it.each(['LOST', 'FOUND'] as const)(
    'edita %s desde manage y omite location si no cambia',
    async (type) => {
      const managed = {
        ...publication,
        type,
        exactLocation: { latitude: 41.1, longitude: -4.2 },
        publicLocation: {
          latitude: 41.11,
          longitude: -4.19,
          radiusMeters: 1_000,
        },
      }
      let patchBody: Record<string, unknown> | undefined
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
          const url = String(input)
          if (url.includes('/auth/me'))
            return json({
              user: { ...publication.author, email: 'diego@example.test' },
            })
          if (url.endsWith(`/publications/${publication.id}/manage`))
            return json({ publication: managed })
          if (
            url.endsWith(`/publications/${publication.id}`) &&
            options?.method === 'PATCH'
          ) {
            patchBody = JSON.parse(String(options.body))
            return json({ publication })
          }
          return json({
            items: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          })
        }),
      )
      renderApp(`/publications/${publication.id}/edit`)
      expect(
        await screen.findByText(/41.100000, -4.200000/),
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(patchBody).toBeDefined())
      expect(patchBody).not.toHaveProperty('location')
    },
  )

  it.each([
    ['Seleccionar punto del mapa', { latitude: 40.4168, longitude: -3.7038 }],
    ['Quitar ubicación', null],
  ] as const)(
    'envía el cambio de ubicación al editar: %s',
    async (action, expectedLocation) => {
      const managed = {
        ...publication,
        exactLocation: { latitude: 41.1, longitude: -4.2 },
        publicLocation: {
          latitude: 41.11,
          longitude: -4.19,
          radiusMeters: 1_000,
        },
      }
      let patchBody: Record<string, unknown> | undefined
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
          const url = String(input)
          if (url.includes('/auth/me'))
            return json({
              user: { ...publication.author, email: 'diego@example.test' },
            })
          if (url.endsWith(`/publications/${publication.id}/manage`))
            return json({ publication: managed })
          if (
            url.endsWith(`/publications/${publication.id}`) &&
            options?.method === 'PATCH'
          ) {
            patchBody = JSON.parse(String(options.body))
            return json({ publication })
          }
          return json({
            items: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          })
        }),
      )
      renderApp(`/publications/${publication.id}/edit`)
      await screen.findByText(/41.100000, -4.200000/)
      fireEvent.click(screen.getByRole('button', { name: action }))
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(patchBody).toBeDefined())
      expect(patchBody?.location).toEqual(expectedLocation)
    },
  )

  it('ADOPTION no reutiliza publicLocation y exige una decisión al pasar a LOST', async () => {
    const managed = {
      ...publication,
      type: 'ADOPTION',
      exactLocation: null,
      publicLocation: { latitude: 39.5, longitude: -0.4, radiusMeters: 5_000 },
    }
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        void options
        const url = String(input)
        if (url.includes('/auth/me'))
          return json({
            user: { ...publication.author, email: 'diego@example.test' },
          })
        if (url.endsWith(`/publications/${publication.id}/manage`))
          return json({ publication: managed })
        return json({
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    renderApp(`/publications/${publication.id}/edit`)
    await screen.findByText('Zona aproximada visible públicamente.')
    expect(
      screen.queryByText(/Coordenadas seleccionadas/),
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'LOST' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ubicación exacta nueva',
    )
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          String(url).endsWith(`/publications/${publication.id}`) &&
          (options as RequestInit | undefined)?.method === 'PATCH',
      ),
    ).toBe(false)
  })
})
