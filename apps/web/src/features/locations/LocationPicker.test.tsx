import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LocationPicker } from './LocationPicker'

vi.mock('./LocationMap', () => ({
  LocationMap: ({
    onChange,
  }: {
    onChange: (value: { latitude: number; longitude: number }) => void
  }) => (
    <button
      type="button"
      onClick={() => onChange({ latitude: 40.4, longitude: -3.7 })}
    >
      Elegir en mapa
    </button>
  ),
}))

const baseProps = {
  mode: 'exact-owner' as const,
  privacyText: 'La ubicación exacta se guarda de forma privada.',
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LocationPicker', () => {
  it('sincroniza selección del mapa y permite eliminarla', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <LocationPicker {...baseProps} value={null} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Elegir en mapa' }))
    expect(onChange).toHaveBeenCalledWith({ latitude: 40.4, longitude: -3.7 })
    rerender(
      <LocationPicker
        {...baseProps}
        value={{ latitude: 40.4, longitude: -3.7 }}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Quitar ubicación' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('acepta entrada manual válida y rechaza la incompleta', () => {
    const onChange = vi.fn()
    render(<LocationPicker {...baseProps} value={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Latitud manual'), {
      target: { value: '41.38' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar coordenadas' }))
    expect(screen.getByRole('alert')).toHaveTextContent('ambas presentes')
    fireEvent.change(screen.getByLabelText('Longitud manual'), {
      target: { value: '2.17' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar coordenadas' }))
    expect(onChange).toHaveBeenCalledWith({ latitude: 41.38, longitude: 2.17 })
  })

  it('solo usa geolocalización tras click y comunica permiso denegado', async () => {
    const onChange = vi.fn()
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })
    render(<LocationPicker {...baseProps} value={null} onChange={onChange} />)
    expect(getCurrentPosition).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    const [success, , options] = getCurrentPosition.mock.calls[0]!
    expect(options).toMatchObject({
      enableHighAccuracy: false,
      timeout: 10_000,
    })
    success({ coords: { latitude: 39.47, longitude: -0.38 } })
    expect(onChange).toHaveBeenCalledWith({ latitude: 39.47, longitude: -0.38 })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Usar mi ubicación' }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    const secondFailure = getCurrentPosition.mock.calls[1]![1]
    secondFailure({ code: 1 })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permiso de ubicación denegado',
    )
  })

  it('se mantiene utilizable cuando geolocation no existe', () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })
    render(<LocationPicker {...baseProps} value={null} onChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Geolocalización no disponible' }),
    ).toBeDisabled()
    expect(screen.getByLabelText('Latitud manual')).toBeEnabled()
  })

  it('expone el modo de privacidad y la zona pública de referencia', () => {
    const { container } = render(
      <LocationPicker
        mode="reference-zone"
        value={null}
        onChange={vi.fn()}
        publicZone={{ latitude: 40, longitude: -3, radiusMeters: 5_000 }}
        privacyText="No publiques tu domicilio exacto."
      />,
    )
    expect(
      container.querySelector('[data-location-mode="reference-zone"]'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Zona aproximada visible públicamente.'),
    ).toBeInTheDocument()
  })
})
