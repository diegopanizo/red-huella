import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MapPublication } from '../../types'
import { GlobalPublicationsMap } from './GlobalPublicationsMap'

const marker = vi.fn()
const mapEvents = vi.fn()
const map = {
  getZoom: () => 6,
  flyTo: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  getBounds: vi.fn<
    () => {
      getNorth(): number
      getSouth(): number
      getWest(): number
      getEast(): number
    }
  >(() => ({
    getNorth: () => 44.5,
    getSouth: () => 27.5,
    getWest: () => -18.5,
    getEast: () => 5,
  })),
}
vi.mock('leaflet', () => ({ divIcon: (options: unknown) => options }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="global-map">{children}</div>
  ),
  TileLayer: () => <div data-testid="tiles" />,
  Marker: (props: {
    children: React.ReactNode
    title: string
    eventHandlers: { click: () => void }
  }) => {
    marker(props)
    return (
      <button
        type="button"
        aria-label={props.title}
        onClick={props.eventHandlers.click}
      >
        {props.children}
      </button>
    )
  },
  Popup: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  useMap: () => map,
  useMapEvents: (events: unknown) => {
    mapEvents(events)
    return map
  },
}))

const publication = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'LOST',
  status: 'ACTIVE',
  title: 'Luna perdida',
  eventDate: '2026-08-20T10:00:00Z',
  publicLocation: { lat: 40.4168, long: -3.7038, radius: 1_000 },
  animal: { name: 'Luna', species: 'DOG', breed: 'Mestiza' },
  thumbnail: null,
  description: 'dato privado fuera del contrato',
  author: { name: 'No mostrar' },
  contact: '+34600000000',
} satisfies MapPublication & Record<string, unknown>

afterEach(() => {
  cleanup()
  marker.mockClear()
  mapEvents.mockClear()
  map.flyTo.mockClear()
  map.once.mockClear()
  map.off.mockClear()
  map.getBounds.mockClear()
})

describe('GlobalPublicationsMap', () => {
  it('renderiza marker aproximado, popup mínimo y selección bidireccional', async () => {
    const onSelectPublication = vi.fn()
    const onBoundsChange = vi.fn()
    render(
      <MemoryRouter>
        <GlobalPublicationsMap
          publications={[publication]}
          selectedPublicationId={null}
          onSelectPublication={onSelectPublication}
          onOpenPublication={vi.fn()}
          initialBounds={{ north: 44.5, south: 27.5, west: -18.5, east: 5 }}
          onBoundsChange={onBoundsChange}
        />
      </MemoryRouter>,
    )

    const markerButton = screen.getByRole('button', {
      name: 'Perdido: Luna; zona aproximada',
    })
    fireEvent.click(markerButton)
    expect(onSelectPublication).toHaveBeenCalledWith(publication.id)
    await waitFor(() => expect(onBoundsChange).toHaveBeenCalledOnce())
    expect(screen.getByText('Perdido')).toHaveClass('map-popup-badge')
    expect(screen.getByText('Perro · Mestiza')).toBeInTheDocument()
    expect(screen.getByText('Zona aproximada protegida')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute(
      'href',
      `/publications/${publication.id}`,
    )
    expect(screen.getByLabelText('Imagen no disponible')).toBeInTheDocument()
    expect(
      document.querySelector('.publication-map-popup .map-popup'),
    ).toHaveAttribute('data-publication-id', publication.id)
    const text = document.body.textContent ?? ''
    for (const forbidden of [
      '40.4168',
      '-3.7038',
      '1000',
      'dato privado',
      'No mostrar',
      '+34600000000',
    ])
      expect(text).not.toContain(forbidden)
  })

  it('usa el thumbnail y cambia a fallback si falla', () => {
    render(
      <MemoryRouter>
        <GlobalPublicationsMap
          publications={[
            {
              ...publication,
              thumbnail: {
                url: '/api/v1/publication-images/image-id/thumbnail',
                width: 640,
                height: 480,
              },
            },
          ]}
          selectedPublicationId={null}
          onSelectPublication={vi.fn()}
          onOpenPublication={vi.fn()}
          initialBounds={{ north: 44.5, south: 27.5, west: -18.5, east: 5 }}
        />
      </MemoryRouter>,
    )
    const image = screen.getByRole('img', { name: 'Imagen de Luna' })
    expect(image.closest('.map-popup')).toHaveTextContent('Luna')
    expect(image.closest('.map-popup')).toHaveTextContent('Perdido')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute(
      'src',
      'http://localhost:3000/api/v1/publication-images/image-id/thumbnail',
    )
    fireEvent.error(image)
    expect(screen.getByLabelText('Imagen no disponible')).toBeInTheDocument()
  })

  it('reporta moveend/zoomend y silencia el centrado programático', async () => {
    const onBoundsChange = vi.fn()
    const props = {
      publications: [publication],
      onSelectPublication: vi.fn(),
      onOpenPublication: vi.fn(),
      initialBounds: { north: 44.5, south: 27.5, west: -18.5, east: 5 },
      onBoundsChange,
    }
    const view = render(
      <MemoryRouter>
        <GlobalPublicationsMap {...props} selectedPublicationId={null} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(onBoundsChange).toHaveBeenCalledOnce())
    const handlers = mapEvents.mock.calls.at(-1)?.[0] as {
      moveend: () => void
      zoomend: () => void
    }
    map.getBounds.mockReturnValue({
      getNorth: () => 45,
      getSouth: () => 35,
      getWest: () => -10,
      getEast: () => 3,
    })
    act(() => handlers.moveend())
    act(() => handlers.zoomend())
    expect(onBoundsChange).toHaveBeenLastCalledWith({
      north: 45,
      south: 35,
      west: -10,
      east: 3,
    })

    const callsBeforeSelection = onBoundsChange.mock.calls.length
    view.rerender(
      <MemoryRouter>
        <GlobalPublicationsMap
          {...props}
          selectedPublicationId={publication.id}
        />
      </MemoryRouter>,
    )
    expect(map.flyTo).toHaveBeenCalledOnce()
    act(() => handlers.moveend())
    expect(onBoundsChange).toHaveBeenCalledTimes(callsBeforeSelection)
  })
})
