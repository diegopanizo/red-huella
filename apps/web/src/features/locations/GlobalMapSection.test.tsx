import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GlobalMapSection } from './GlobalMapSection'

vi.mock('./GlobalPublicationsMap', () => ({
  GlobalPublicationsMap: ({
    publications,
    selectedPublicationId,
    onSelectPublication,
    onBoundsChange,
    focusBounds,
  }: {
    publications: Array<{ id: string }>
    selectedPublicationId: string | null
    onSelectPublication: (id: string) => void
    onBoundsChange: (bounds: {
      north: number
      south: number
      west: number
      east: number
    }) => void
    focusBounds?: {
      north: number
      south: number
      west: number
      east: number
    } | null
  }) => {
    React.useEffect(() => {
      if (!focusBounds)
        onBoundsChange({ north: 44.5, south: 27.5, west: -18.5, east: 5 })
    }, [focusBounds, onBoundsChange])
    return (
      <div
        data-testid="map-publications"
        data-selected={selectedPublicationId ?? ''}
        data-focus-bounds={focusBounds ? JSON.stringify(focusBounds) : ''}
      >
        <button
          type="button"
          onClick={() =>
            onBoundsChange({ north: 45, south: 35, west: -10, east: 3 })
          }
        >
          Simular pan
        </button>
        <button
          type="button"
          onClick={() =>
            onBoundsChange({ north: 43, south: 39, west: -6, east: 1 })
          }
        >
          Simular zoom
        </button>
        {publications.map((publication) => (
          <button
            key={publication.id}
            onClick={() => onSelectPublication(publication.id)}
          >
            Marker {publication.id}
          </button>
        ))}
      </div>
    )
  },
}))

const publication = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'FOUND',
  status: 'ACTIVE',
  title: 'Gato encontrado',
  eventDate: '2026-08-20T10:00:00Z',
  publicLocation: { lat: 40.4, long: -3.7, radius: 1_500 },
  animal: { name: null, species: 'CAT', breed: null },
  thumbnail: null,
}

function renderSection(
  filters = {},
  nearbyArea: {
    latitude: number
    longitude: number
    radiusMeters: number
  } | null = null,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GlobalMapSection filters={filters} nearbyArea={nearbyArea} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('GlobalMapSection', () => {
  it('en móvil alterna lista y mapa sin perder resultados, selección ni consultar de nuevo', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(max-width: 800px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            publications: [publication],
            truncated: false,
            limit: 500,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderSection({ species: 'CAT' as const })

    const listButton = screen.getByRole('button', { name: 'Lista' })
    const mapButton = screen.getByRole('button', { name: 'Mapa' })
    const list = document.getElementById('global-map-list')
    const mapPanel = document.getElementById('global-map-panel')
    expect(listButton).toHaveAttribute('aria-pressed', 'true')
    expect(mapButton).toHaveAttribute('aria-pressed', 'false')
    expect(list).not.toHaveAttribute('hidden')
    expect(mapPanel).toHaveAttribute('hidden')

    const card = await screen.findByRole('button', { name: /Gato encontrado/ })
    const callsBeforeToggle = fetchMock.mock.calls.length
    fireEvent.click(card)
    expect(mapButton).toHaveAttribute('aria-pressed', 'true')
    expect(list).toHaveAttribute('hidden')
    expect(mapPanel).not.toHaveAttribute('hidden')
    expect(screen.getByTestId('map-publications')).toHaveAttribute(
      'data-selected',
      publication.id,
    )

    fireEvent.click(listButton)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeToggle)
    fireEvent.click(mapButton)
    fireEvent.click(screen.getByRole('button', { name: 'Simular pan' }))
    expect(
      screen.getByRole('button', { name: 'Buscar en esta zona' }),
    ).toBeInTheDocument()
  })

  it('en escritorio conserva simultáneamente lista y mapa sin selector', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              publications: [publication],
              truncated: false,
              limit: 500,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )
    renderSection()
    await screen.findByRole('button', { name: /Gato encontrado/ })
    expect(
      screen.queryByRole('group', {
        name: 'Vista de publicaciones geográficas',
      }),
    ).not.toBeInTheDocument()
    expect(document.getElementById('global-map-list')).not.toHaveAttribute(
      'hidden',
    )
    expect(document.getElementById('global-map-panel')).not.toHaveAttribute(
      'hidden',
    )
  })

  it('aplica Cerca de mí al viewport y mantiene el listado cercano al explorar otra zona', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        urls.push(String(input))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              publications: [publication],
              truncated: false,
              limit: 500,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }),
    )
    renderSection(
      { type: 'LOST' as const },
      { latitude: 40.4, longitude: -3.7, radiusMeters: 25_000 },
    )

    expect(
      await screen.findByText('Mapa centrado en tu zona de búsqueda de 25 km.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        urls.some((value) => {
          const url = new URL(value)
          return (
            url.searchParams.get('type') === 'LOST' &&
            Number(url.searchParams.get('north')) > 40.4 &&
            Number(url.searchParams.get('south')) < 40.4
          )
        }),
      ).toBe(true),
    )
    expect(screen.getByTestId('map-publications')).toHaveAttribute(
      'data-focus-bounds',
      expect.stringContaining('"north"'),
    )
    expect(
      urls.every((url) => !/[?&](latitude|longitude|radiusMeters)=/.test(url)),
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Simular pan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en esta zona' }))
    expect(
      await screen.findByText(
        'El listado sigue filtrado Cerca de mí; el mapa muestra la zona que elegiste.',
      ),
    ).toBeInTheDocument()
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })

  it('muestra loading, lista y mapa con los mismos IDs, selección y aviso truncated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              publications: [publication],
              truncated: true,
              limit: 500,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )
    const view = renderSection()
    expect(
      screen.getByText('Cargando mapa de publicaciones…'),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Gato encontrado/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/demasiados resultados/)).toBeInTheDocument()
    expect(screen.getByText(/aproximadas para proteger/)).toBeInTheDocument()
    expect(
      view.container.querySelectorAll(
        `[data-publication-id="${publication.id}"]`,
      ),
    ).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: `Marker ${publication.id}` }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: `Marker ${publication.id}` }),
    )
    expect(screen.getByTestId('map-publications')).toHaveAttribute(
      'data-selected',
      publication.id,
    )
    const cardButton = screen.getByRole('button', { name: /Gato encontrado/ })
    fireEvent.click(cardButton)
    expect(cardButton).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.queryByRole('button', { name: 'Buscar en esta zona' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute(
      'href',
      `/publications/${publication.id}`,
    )
    expect(document.body).not.toHaveTextContent('40.4')
    expect(document.body).not.toHaveTextContent('-3.7')
  })

  it.each([
    [500, 'No pudimos cargar las publicaciones del mapa.'],
    [429, 'Has realizado demasiadas búsquedas en el mapa.'],
  ])('aísla el error HTTP %s', async (status, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: 'ERROR', message: 'interno' } }),
            {
              status,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      ),
    )
    renderSection()
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('acumula pan/zoom sin consultar y aplica solo los últimos bounds al click', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        urls.push(String(input))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              publications: [publication],
              truncated: false,
              limit: 500,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }),
    )
    renderSection()
    await waitFor(() => expect(urls).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Simular pan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular zoom' }))
    expect(urls).toHaveLength(1)
    expect(screen.getByText(/El mapa se movió/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Buscar en esta zona' }))
    await waitFor(() => expect(urls).toHaveLength(2))
    expect(Object.fromEntries(new URL(urls[1]!).searchParams)).toMatchObject({
      north: '43',
      south: '39',
      west: '-6',
      east: '1',
    })
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })

  it.each([
    [500, 'No pudimos actualizar esta zona del mapa.'],
    [429, 'Has realizado demasiadas búsquedas en el mapa.'],
  ])(
    'conserva resultados al fallar una actualización con %s',
    async (status, message) => {
      let calls = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          calls += 1
          return Promise.resolve(
            calls === 1
              ? new Response(
                  JSON.stringify({
                    publications: [publication],
                    truncated: false,
                    limit: 500,
                  }),
                  {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  },
                )
              : new Response(
                  JSON.stringify({
                    error: { code: 'ERROR', message: 'interno' },
                  }),
                  { status, headers: { 'Content-Type': 'application/json' } },
                ),
          )
        }),
      )
      renderSection()
      expect(
        await screen.findByRole('button', { name: /Gato encontrado/ }),
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Simular pan' }))
      fireEvent.click(
        screen.getByRole('button', { name: 'Buscar en esta zona' }),
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(
        screen.getByRole('button', { name: /Gato encontrado/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Buscar en esta zona' }),
      ).toBeInTheDocument()
    },
  )

  it('cancela la zona anterior, ignora su respuesta tardía y limpia selección ausente', async () => {
    let calls = 0
    let resolveOld: ((response: Response) => void) | undefined
    let oldSignal: AbortSignal | null | undefined
    const replacement = {
      ...publication,
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Resultado de la zona B',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((_: RequestInfo | URL, options?: RequestInit) => {
        calls += 1
        if (calls === 1)
          return Promise.resolve(
            new Response(
              JSON.stringify({
                publications: [publication],
                truncated: false,
                limit: 500,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        if (calls === 2) {
          oldSignal = options?.signal
          return new Promise<Response>((resolve) => {
            resolveOld = resolve
          })
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              publications: [replacement],
              truncated: false,
              limit: 500,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }),
    )
    renderSection()
    const initialCard = await screen.findByRole('button', {
      name: /Gato encontrado/,
    })
    fireEvent.click(initialCard)
    expect(screen.getByTestId('map-publications')).toHaveAttribute(
      'data-selected',
      publication.id,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Simular pan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en esta zona' }))
    await waitFor(() => expect(calls).toBe(2))
    fireEvent.click(screen.getByRole('button', { name: 'Simular zoom' }))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en esta zona' }))

    expect(
      await screen.findByRole('button', { name: /Resultado de la zona B/ }),
    ).toBeInTheDocument()
    expect(oldSignal?.aborted).toBe(true)
    expect(screen.getByTestId('map-publications')).toHaveAttribute(
      'data-selected',
      '',
    )

    resolveOld?.(
      new Response(
        JSON.stringify({
          publications: [{ ...publication, title: 'Respuesta obsoleta A' }],
          truncated: false,
          limit: 500,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await waitFor(() =>
      expect(
        screen.queryByText('Respuesta obsoleta A'),
      ).not.toBeInTheDocument(),
    )
  })

  it('refetch al cambiar filtros sin enviar parámetros ajenos', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        urls.push(String(input))
        return Promise.resolve(
          new Response(
            JSON.stringify({ publications: [], truncated: false, limit: 500 }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }),
    )
    const view = renderSection({ type: 'LOST' as const })
    await waitFor(() => expect(urls).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Simular pan' }))
    expect(
      screen.getByRole('button', { name: 'Buscar en esta zona' }),
    ).toBeInTheDocument()
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <GlobalMapSection
            filters={{ type: 'FOUND', species: 'CAT', status: 'RESOLVED' }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(urls).toHaveLength(2))
    const second = new URL(urls[1]!)
    expect(Object.fromEntries(second.searchParams)).toMatchObject({
      north: '44.5',
      south: '27.5',
      west: '-18.5',
      east: '5',
      type: 'FOUND',
      species: 'CAT',
      status: 'RESOLVED',
    })
    expect(second.searchParams.has('ARCHIVED')).toBe(false)
    expect(second.searchParams.has('page')).toBe(false)
  })
})
