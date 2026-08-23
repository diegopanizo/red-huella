import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError } from '../../services/api'
import { VisualSearchPage } from './VisualSearchPage'

vi.mock('../../services/api', async (original) => ({
  ...(await original<typeof import('../../services/api')>()),
  api: { searchPublicationsByImage: vi.fn() },
}))
const searchApi = vi.mocked(api.searchPublicationsByImage)
const result = {
  publication: {
    id: 'publication-id',
    type: 'LOST' as const,
    title: 'Se busca a Luna',
    eventDate: '2026-08-20T10:00:00Z',
    animal: { name: 'Luna', species: 'DOG' as const, breed: 'Collie' },
    primaryImage: { id: 'primary-id', thumbnailUrl: '/primary' },
    publicLocation: { latitude: 40, longitude: -3, radiusMeters: 1000 },
  },
  matchedImage: { id: 'matched-id', thumbnailUrl: '/matched' },
  visualSimilarity: 0.9,
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const renderPage = () =>
  render(
    <MemoryRouter>
      <VisualSearchPage />
    </MemoryRouter>,
  )
const select = (
  file = new File(['image'], 'luna.jpg', { type: 'image/jpeg' }),
) =>
  fireEvent.change(screen.getByLabelText(/Selecciona o arrastra/), {
    target: { files: [file] },
  })

describe('VisualSearchPage', () => {
  it('presenta un selector accesible, privacidad y estado inicial limpio', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { name: 'Buscar por foto' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Selecciona o arrastra/)).toHaveAttribute(
      'accept',
      expect.stringContaining('image/webp'),
    )
    expect(
      screen.getByText(/no se añade a ninguna publicación/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Resultados visualmente similares'),
    ).not.toBeInTheDocument()
  })

  it('valida, muestra preview y envía filtros sin búsqueda automática', async () => {
    searchApi.mockResolvedValue({ items: [result] })
    renderPage()
    select()
    expect(
      screen.getByAltText('Vista previa de la foto seleccionada'),
    ).toHaveAttribute('src', 'blob:preview')
    expect(screen.getByText('luna.jpg')).toBeInTheDocument()
    expect(searchApi).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Buscar entre'), {
      target: { value: 'FOUND' },
    })
    fireEvent.change(screen.getByLabelText('Especie'), {
      target: { value: 'DOG' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar similares' }))
    await screen.findByText('Resultados visualmente similares')
    expect(screen.getByText('Similitud visual')).toBeInTheDocument()
    expect(screen.getByText('Foto visualmente similar')).toBeInTheDocument()
    expect(screen.queryByText('Coincidencia visual')).not.toBeInTheDocument()
    expect(searchApi).toHaveBeenCalledWith(
      expect.any(File),
      { targetType: 'FOUND', species: 'DOG', limit: 20 },
      expect.any(AbortSignal),
    )
    expect(screen.getByAltText(/Foto visualmente similar/)).toHaveAttribute(
      'src',
      'http://localhost:3000/matched',
    )
    expect(screen.queryByText(/0.9|90 %/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ver publicación' }),
    ).toHaveAttribute('href', '/publications/publication-id')
  })

  it('muestra validaciones y estados empty, 429 y 503', async () => {
    renderPage()
    select(new File(['x'], 'pet.gif', { type: 'image/gif' }))
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG o WebP')
    select()
    searchApi.mockResolvedValueOnce({ items: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar similares' }))
    expect(
      await screen.findByText(
        'No encontramos publicaciones visualmente similares.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva búsqueda' }))
    select()
    searchApi.mockRejectedValueOnce(new ApiError(429, 'RATE', 'internal'))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar similares' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'varias búsquedas',
    )
    searchApi.mockRejectedValueOnce(new ApiError(503, 'DOWN', 'internal'))
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'no está disponible temporalmente',
      ),
    )
  })
})
