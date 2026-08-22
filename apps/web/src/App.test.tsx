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
import { afterEach, describe, expect, it, vi } from 'vitest'

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
})
