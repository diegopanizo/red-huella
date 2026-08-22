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
  location: null,
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
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'LOST' },
    })
    await waitFor(() => expect(window.location.search).toContain('type=LOST'))
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
})
