import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type React from 'react'

import type { Publication } from '../../types'
import {
  ImagePicker,
  OwnerImageManager,
  PublicationGallery,
} from './PublicationImages'
import { usePendingImages } from './usePendingImages'

const createObjectURL = vi.fn((file: File) => `blob:${file.name}`)
const revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function PickerHarness() {
  const pending = usePendingImages()
  return <ImagePicker pending={pending} />
}

function imageFile(name: string, type = 'image/jpeg', size = 10) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('selector y previews', () => {
  it('crea previews múltiples, permite quitar y revoca URLs', () => {
    const view = render(<PickerHarness />)
    fireEvent.change(screen.getByLabelText('Seleccionar imágenes'), {
      target: {
        files: [imageFile('one.jpg'), imageFile('two.png', 'image/png')],
      },
    })
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByText('2 de 6 seleccionadas')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0]!)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:one.jpg')
    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:two.png')
  })

  it('rechaza formato, tamaño y selecciones que superan seis', () => {
    render(<PickerHarness />)
    fireEvent.change(screen.getByLabelText('Seleccionar imágenes'), {
      target: {
        files: [
          imageFile('bad.gif', 'image/gif'),
          imageFile('huge.jpg', 'image/jpeg', 8 * 1024 * 1024 + 1),
        ],
      },
    })
    expect(screen.getByText(/bad.gif: formato no admitido/)).toBeInTheDocument()
    expect(screen.getByText(/huge.jpg: supera el límite/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Seleccionar imágenes'), {
      target: {
        files: Array.from({ length: 7 }, (_, index) =>
          imageFile(`${index}.jpg`),
        ),
      },
    })
    expect(screen.getAllByRole('img')).toHaveLength(6)
    expect(
      screen.getByText('Solo puedes seleccionar 6 imágenes.'),
    ).toBeInTheDocument()
  })
})

describe('galería', () => {
  it('muestra principal y cambia mediante botones accesibles', () => {
    render(<PublicationGallery publication={publication()} />)
    expect(screen.getByAltText('Imagen de Rocky')).toHaveAttribute(
      'src',
      'http://localhost:3000/api/v1/publication-images/image-1/content',
    )
    fireEvent.click(screen.getByRole('button', { name: /Mostrar imagen 2/ }))
    expect(screen.getByAltText('Imagen de Rocky')).toHaveAttribute(
      'src',
      'http://localhost:3000/api/v1/publication-images/image-2/content',
    )
    expect(
      screen.getByRole('button', { name: /Mostrar imagen 2/ }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('muestra fallback si la imagen principal falla', () => {
    render(<PublicationGallery publication={publication()} />)
    fireEvent.error(screen.getByAltText('Imagen de Rocky'))
    expect(screen.getByLabelText('Imagen no disponible')).toBeInTheDocument()
  })
})

describe('gestión owner', () => {
  it('sube, elimina, reordena e invalida las tres familias de queries', async () => {
    const fetchMock = vi.fn(() => response({ images: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(
      <QueryClientProvider client={client}>
        <OwnerImageManager publication={publication()} />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText('Seleccionar imágenes'), {
      target: { files: [imageFile('new.jpg')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir imágenes' }))
    await screen.findByText('Imágenes añadidas correctamente.')

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Hacer principal' })[1]!,
    )
    await screen.findByText('Orden de imágenes actualizado.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]!)
    await screen.findByText('Imagen eliminada.')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/images/order'),
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/images\/image-1$/),
      expect.objectContaining({ method: 'DELETE' }),
    )
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['publications'] })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-publications'] })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['publication', 'publication-id'],
      })
    })
  })

  it('en archived permite eliminar pero oculta añadir y reordenar', () => {
    renderWithClient(
      <OwnerImageManager publication={publication({ status: 'ARCHIVED' })} />,
    )
    expect(
      screen.queryByLabelText('Seleccionar imágenes'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hacer principal' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(2)
  })

  it('con seis imágenes deshabilita la incorporación', () => {
    const base = publication()
    renderWithClient(
      <OwnerImageManager
        publication={{
          ...base,
          images: Array.from({ length: 6 }, (_, index) => ({
            ...base.images[0]!,
            id: `image-${index}`,
            position: index,
          })),
        }}
      />,
    )
    expect(
      screen.getByText('Has alcanzado el máximo de 6 imágenes.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Seleccionar imágenes'),
    ).not.toBeInTheDocument()
  })
})

function renderWithClient(node: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {node}
    </QueryClientProvider>,
  )
}

function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function publication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'publication-id',
    type: 'LOST',
    title: 'Se busca a Rocky',
    description: null,
    status: 'ACTIVE',
    eventDate: '2026-08-20T10:00:00Z',
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
    resolvedAt: null,
    publicLocation: null,
    animal: {
      id: 'animal-id',
      name: 'Rocky',
      species: 'DOG',
      breed: null,
      sex: 'UNKNOWN',
      color: null,
      size: 'UNKNOWN',
      approximateAge: null,
      description: null,
    },
    author: { id: 'owner-id', name: 'Owner', role: 'USER' },
    images: [
      {
        id: 'image-1',
        position: 0,
        url: '/api/v1/publication-images/image-1/content',
        thumbnailUrl: '/api/v1/publication-images/image-1/thumbnail',
        width: 1200,
        height: 800,
      },
      {
        id: 'image-2',
        position: 1,
        url: '/api/v1/publication-images/image-2/content',
        thumbnailUrl: '/api/v1/publication-images/image-2/thumbnail',
        width: 1200,
        height: 800,
      },
    ],
    ...overrides,
  }
}
