import '@testing-library/jest-dom/vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../../services/api'
import { useVisualSearch, validateVisualSearchFile } from './useVisualSearch'

vi.mock('../../services/api', async (original) => ({
  ...(await original<typeof import('../../services/api')>()),
  api: { searchPublicationsByImage: vi.fn() },
}))
const searchApi = vi.mocked(api.searchPublicationsByImage)

beforeEach(() => {
  URL.createObjectURL = vi.fn((file: File) => `blob:${file.name}`)
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useVisualSearch', () => {
  it('valida formato y tamaño de forma preventiva', () => {
    expect(
      validateVisualSearchFile(
        new File(['x'], 'pet.gif', { type: 'image/gif' }),
      ),
    ).toMatch(/JPEG/)
    expect(
      validateVisualSearchFile(
        new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'pet.jpg', {
          type: 'image/jpeg',
        }),
      ),
    ).toMatch(/8 MB/)
  })

  it('crea preview, busca, expone resultados y resetea liberando la URL', async () => {
    searchApi.mockResolvedValue({ items: [] })
    const { result } = renderHook(() => useVisualSearch())
    const file = new File(['x'], 'pet.jpg', { type: 'image/jpeg' })
    act(() => {
      result.current.selectFile(file)
    })
    expect(result.current.previewUrl).toBe('blob:pet.jpg')
    await act(() => result.current.search({ limit: 20 }))
    expect(result.current.state).toBe('success')
    expect(searchApi).toHaveBeenCalledWith(
      file,
      { limit: 20 },
      expect.any(AbortSignal),
    )
    act(() => result.current.reset())
    expect(result.current.state).toBe('initial')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pet.jpg')
  })

  it('conserva el error y permite reintentar con el mismo archivo', async () => {
    searchApi
      .mockRejectedValueOnce(new Error('fallo'))
      .mockResolvedValueOnce({ items: [] })
    const { result } = renderHook(() => useVisualSearch())
    act(() => {
      result.current.selectFile(
        new File(['x'], 'pet.png', { type: 'image/png' }),
      )
    })
    await act(() => result.current.search({ limit: 20 }))
    expect(result.current.state).toBe('error')
    await act(() => result.current.search({ limit: 20 }))
    expect(result.current.state).toBe('success')
  })

  it('aborta la petición anterior e ignora su respuesta tardía', async () => {
    let resolveFirst: ((value: { items: [] }) => void) | undefined
    searchApi
      .mockImplementationOnce(
        (_file, _filters, signal) =>
          new Promise((resolve) => {
            resolveFirst = resolve
            expect(signal?.aborted).toBe(false)
          }),
      )
      .mockResolvedValueOnce({ items: [] })
    const { result } = renderHook(() => useVisualSearch())
    act(() => {
      result.current.selectFile(
        new File(['x'], 'first.jpg', { type: 'image/jpeg' }),
      )
    })
    let first: Promise<void>
    act(() => {
      first = result.current.search({ limit: 20 })
    })
    const firstSignal = searchApi.mock.calls[0]?.[2]
    act(() => {
      result.current.selectFile(
        new File(['y'], 'second.jpg', { type: 'image/jpeg' }),
      )
    })
    expect(firstSignal?.aborted).toBe(true)
    await act(() => result.current.search({ limit: 20 }))
    act(() => resolveFirst?.({ items: [] }))
    await act(() => first!)
    await waitFor(() => expect(result.current.state).toBe('success'))
  })
})
