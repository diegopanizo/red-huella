import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicLocationMap } from './PublicLocationMap'

const circle = vi.fn()
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="leaflet-map">{children}</div>
  ),
  TileLayer: ({ attribution }: { attribution: string }) => (
    <div dangerouslySetInnerHTML={{ __html: attribution }} />
  ),
  Circle: (props: unknown) => {
    circle(props)
    return <div data-testid="public-circle" />
  },
}))

afterEach(() => {
  cleanup()
  circle.mockClear()
})

describe('PublicLocationMap', () => {
  it.each([
    ['LOST', 'Zona aproximada donde se reportó la pérdida'],
    ['FOUND', 'Zona aproximada donde fue encontrado'],
    ['ADOPTION', 'Zona aproximada de referencia'],
  ] as const)('presenta el contexto público para %s', (type, context) => {
    const publicLocation = {
      latitude: 40.4168,
      longitude: -3.7038,
      radiusMeters: 1_500,
    }
    render(<PublicLocationMap publicLocation={publicLocation} type={type} />)
    expect(screen.getByRole('heading', { name: context })).toBeInTheDocument()
    expect(
      screen.getByText('Por privacidad, la ubicación mostrada es aproximada.'),
    ).toBeInTheDocument()
    expect(circle).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [publicLocation.latitude, publicLocation.longitude],
        radius: 1_500,
      }),
    )
    expect(
      screen.getByRole('link', { name: 'OpenStreetMap' }),
    ).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('40.4168')
    expect(document.body).not.toHaveTextContent('-3.7038')
  })
})
