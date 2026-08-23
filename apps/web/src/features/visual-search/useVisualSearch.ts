import React from 'react'

import { api } from '../../services/api'
import type { VisualSearchFilters, VisualSearchResult } from '../../types'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedExtensions = /\.(?:jpe?g|png|webp)$/i
const maximumBytes = 8 * 1024 * 1024

export type VisualSearchState =
  'initial' | 'ready' | 'loading' | 'success' | 'error'

export function validateVisualSearchFile(file: File): string | undefined {
  if (!allowedTypes.has(file.type) || !allowedExtensions.test(file.name))
    return 'Usa una imagen JPEG, PNG o WebP.'
  if (file.size > maximumBytes) return 'La imagen no puede superar 8 MB.'
  return undefined
}

export function useVisualSearch() {
  const [file, setFileState] = React.useState<File | undefined>(undefined)
  const [previewUrl, setPreviewUrl] = React.useState<string | undefined>(
    undefined,
  )
  const [state, setState] = React.useState<VisualSearchState>('initial')
  const [results, setResults] = React.useState<VisualSearchResult[]>([])
  const [error, setError] = React.useState<unknown>(undefined)
  const controllerRef = React.useRef<AbortController | undefined>(undefined)
  const requestIdRef = React.useRef(0)
  const previewRef = React.useRef<string | undefined>(undefined)

  const releasePreview = React.useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = undefined
    setPreviewUrl(undefined)
  }, [])
  const abort = React.useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = undefined
    requestIdRef.current += 1
  }, [])
  const selectFile = React.useCallback(
    (next: File) => {
      const validationError = validateVisualSearchFile(next)
      if (validationError) {
        abort()
        releasePreview()
        setFileState(undefined)
        setResults([])
        setError(new Error(validationError))
        setState('error')
        return false
      }
      abort()
      releasePreview()
      const url = URL.createObjectURL(next)
      previewRef.current = url
      setPreviewUrl(url)
      setFileState(next)
      setResults([])
      setError(undefined)
      setState('ready')
      return true
    },
    [abort, releasePreview],
  )
  const search = React.useCallback(
    async (filters: VisualSearchFilters) => {
      if (!file) return
      abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const requestId = ++requestIdRef.current
      setState('loading')
      setError(undefined)
      try {
        const response = await api.searchPublicationsByImage(
          file,
          filters,
          controller.signal,
        )
        if (requestId !== requestIdRef.current || controller.signal.aborted)
          return
        setResults(response.items)
        setState('success')
      } catch (nextError) {
        if (requestId !== requestIdRef.current || controller.signal.aborted)
          return
        setError(nextError)
        setState('error')
      } finally {
        if (controllerRef.current === controller)
          controllerRef.current = undefined
      }
    },
    [abort, file],
  )
  const reset = React.useCallback(() => {
    abort()
    releasePreview()
    setFileState(undefined)
    setResults([])
    setError(undefined)
    setState('initial')
  }, [abort, releasePreview])

  React.useEffect(
    () => () => {
      controllerRef.current?.abort()
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  return { file, previewUrl, state, results, error, selectFile, search, reset }
}
