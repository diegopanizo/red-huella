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

import { AuthProvider, useAuth } from '../auth/AuthProvider'
import { PublicationContactPanel } from './PublicationContactPanel'

const id = '11111111-1111-4111-8111-111111111111'
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

function renderPanel(
  fetchMock: ReturnType<typeof vi.fn>,
  status: 'ACTIVE' | 'RESOLVED' = 'ACTIVE',
) {
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <PublicationContactPanel
            publicationId={id}
            publicationStatus={status}
            animalName={'Nube & Sol? #100% "canela"'}
          />
          <LogoutProbe />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  )
  return { ...view, client }
}

function LogoutProbe() {
  const auth = useAuth()
  return (
    <button type="button" onClick={() => void auth.logout()}>
      Cerrar sesión de prueba
    </button>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PublicationContactPanel', () => {
  it('announces loading while the explicit request is pending', async () => {
    let resolveContact: ((response: Response) => void) | undefined
    const pendingContact = new Promise<Response>((resolve) => {
      resolveContact = resolve
    })
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/auth/me')
        ? json({
            user: {
              id: 'user',
              name: 'Ana',
              email: 'ana@example.test',
              role: 'USER',
            },
          })
        : pendingContact,
    )
    renderPanel(fetchMock)
    const reveal = await screen.findByRole('button', {
      name: 'Ver opciones de contacto',
    })
    await waitFor(() => expect(reveal).toBeEnabled())
    fireEvent.click(reveal)
    expect(
      await screen.findByText('Cargando opciones de contacto…'),
    ).toHaveAttribute('aria-live', 'polite')
    resolveContact?.(
      new Response(JSON.stringify({ contact: { methods: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('does not request PII until an authenticated explicit click, renders methods and hides cache', async () => {
    let contactRequests = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/me'))
        return json({
          user: {
            id: 'user',
            name: 'Ana',
            email: 'ana@example.test',
            role: 'USER',
          },
        })
      contactRequests += 1
      return json({
        contact: {
          methods: [
            { type: 'WHATSAPP', value: '+34600111222' },
            { type: 'PHONE', value: '+34600999888' },
            { type: 'EMAIL', value: 'contacto@example.com' },
          ],
        },
      })
    })
    const { client } = renderPanel(fetchMock)
    const reveal = await screen.findByRole('button', {
      name: 'Ver opciones de contacto',
    })
    await waitFor(() => expect(reveal).toBeEnabled())
    expect(contactRequests).toBe(0)
    fireEvent.mouseOver(reveal)
    expect(contactRequests).toBe(0)
    fireEvent.click(reveal)
    expect(
      await screen.findByRole('link', { name: 'Contactar por WhatsApp' }),
    ).toHaveAttribute('rel', 'noopener noreferrer')
    expect(
      screen.getByRole('link', { name: 'Llamar por teléfono' }),
    ).toHaveAttribute('href', 'tel:+34600999888')
    expect(screen.getByRole('link', { name: 'Enviar email' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:contacto@example\.com\?/),
    )
    expect(contactRequests).toBe(1)
    expect(
      client
        .getQueryCache()
        .findAll()
        .some((query) => query.queryKey.includes('+34600111222')),
    ).toBe(false)

    fireEvent.click(
      screen.getByRole('button', { name: 'Ocultar datos de contacto' }),
    )
    expect(screen.queryByText('+34600111222')).not.toBeInTheDocument()
    expect(client.getQueryData(['publication-contact', id])).toBeUndefined()
  })

  it('redirects an anonymous user to login with an internal return URL without requesting contact', async () => {
    let contactRequests = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) return json({}, 401)
      contactRequests += 1
      return json({ contact: { methods: [] } })
    })
    renderPanel(fetchMock)
    const reveal = await screen.findByRole('button', {
      name: 'Ver opciones de contacto',
    })
    await waitFor(() => expect(reveal).toBeEnabled())
    fireEvent.click(reveal)
    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe(
      `/publications/${id}`,
    )
    expect(contactRequests).toBe(0)
  })

  it('removes revealed PII from query cache on logout', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/me'))
        return json({
          user: {
            id: 'user',
            name: 'Ana',
            email: 'ana@example.test',
            role: 'USER',
          },
        })
      if (url.endsWith('/auth/logout'))
        return Promise.resolve(new Response(null, { status: 204 }))
      return json({
        contact: {
          methods: [{ type: 'PHONE', value: '+34600111222' }],
        },
      })
    })
    const { client } = renderPanel(fetchMock)
    const reveal = await screen.findByRole('button', {
      name: 'Ver opciones de contacto',
    })
    await waitFor(() => expect(reveal).toBeEnabled())
    fireEvent.click(reveal)
    expect(await screen.findByText('+34600111222')).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión de prueba' }),
    )
    await waitFor(() =>
      expect(client.getQueryData(['publication-contact', id])).toBeUndefined(),
    )
  })

  it.each([
    [404, 'Los datos de contacto ya no están disponibles.'],
    [429, 'Has realizado demasiadas consultas. Inténtalo de nuevo más tarde.'],
    [503, 'No se pudieron cargar las opciones de contacto.'],
    [
      401,
      'Tu sesión ha expirado. Inicia sesión nuevamente para consultar el contacto.',
    ],
  ])('maps HTTP %s to a safe message', async (status, message) => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/auth/me')
        ? json({
            user: {
              id: 'user',
              name: 'Ana',
              email: 'ana@example.test',
              role: 'USER',
            },
          })
        : json(
            { error: { code: 'PRIVATE_ERROR', message: 'internal detail' } },
            status,
          ),
    )
    renderPanel(fetchMock)
    const reveal = await screen.findByRole('button', {
      name: 'Ver opciones de contacto',
    })
    await waitFor(() => expect(reveal).toBeEnabled())
    fireEvent.click(reveal)
    expect(await screen.findByText(message)).toBeVisible()
  })

  it('does not render a contact CTA for a non-active publication', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/auth/me') ? json({}, 401) : json({}),
    )
    renderPanel(fetchMock, 'RESOLVED')
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: 'Ver opciones de contacto' }),
    ).not.toBeInTheDocument()
  })
})
