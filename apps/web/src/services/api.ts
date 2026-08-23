import type {
  Publication,
  PublicationImage,
  PublicationList,
  ManagePublication,
  PublicationContactSettings,
  MapBounds,
  MapPublicationsResponse,
  PublicationStatus,
  PublicationType,
  User,
  VisualSearchFilters,
  VisualSearchResponse,
} from '../types'

export interface MapPublicationFilters {
  type?: PublicationType | undefined
  species?: 'DOG' | 'CAT' | 'OTHER' | undefined
  status?: Exclude<PublicationStatus, 'ARCHIVED'> | undefined
}

const apiUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | undefined
  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      | { error?: { code?: string; message?: string; requestId?: string } }
      | undefined
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? 'No se pudo completar la solicitud',
      body?.error?.requestId,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function resolveApiAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return new URL(path, window.location.origin).toString()
}

export const api = {
  me: () => requestJson<{ user: User }>('/auth/me'),
  login: (body: { email: string; password: string }) =>
    requestJson<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  register: (body: { name: string; email: string; password: string }) =>
    requestJson<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => requestJson<void>('/auth/logout', { method: 'POST' }),
  publications: (query: string) =>
    requestJson<PublicationList>(`/publications?${query}`),
  getMapPublications: (
    bounds: MapBounds,
    filters: MapPublicationFilters = {},
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams({
      north: String(bounds.north),
      south: String(bounds.south),
      west: String(bounds.west),
      east: String(bounds.east),
    })
    if (filters.type) query.set('type', filters.type)
    if (filters.species) query.set('species', filters.species)
    if (filters.status) query.set('status', filters.status)
    return requestJson<MapPublicationsResponse>(
      `/publications/map?${query.toString()}`,
      signal ? { signal } : {},
    )
  },
  mine: () => requestJson<PublicationList>('/publications/mine?pageSize=100'),
  publication: (id: string) =>
    requestJson<{ publication: Publication }>(`/publications/${id}`),
  managePublication: (id: string) =>
    requestJson<{ publication: ManagePublication }>(
      `/publications/${id}/manage`,
    ),
  getPublicationContactSettings: (id: string) =>
    requestJson<{ contactSettings: PublicationContactSettings }>(
      `/publications/${id}/contact-settings`,
    ),
  getPublicationContact: (id: string) =>
    requestJson<{ contact: PublicationContactSettings }>(
      `/publications/${id}/contact`,
    ),
  replacePublicationContactSettings: (
    id: string,
    body: PublicationContactSettings,
  ) =>
    requestJson<{ contactSettings: PublicationContactSettings }>(
      `/publications/${id}/contact-settings`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  createPublication: (body: unknown) =>
    requestJson<{ publication: Publication }>('/publications', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updatePublication: (id: string, body: unknown) =>
    requestJson<{ publication: Publication }>(`/publications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  changeStatus: (id: string, status: Publication['status']) =>
    requestJson<{ publication: Publication }>(`/publications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  uploadPublicationImages: (id: string, files: readonly File[]) => {
    const body = new FormData()
    for (const file of files) body.append('images', file)
    return requestJson<{ images: PublicationImage[] }>(
      `/publications/${id}/images`,
      { method: 'POST', body },
    )
  },
  deletePublicationImage: (publicationId: string, imageId: string) =>
    requestJson<void>(`/publications/${publicationId}/images/${imageId}`, {
      method: 'DELETE',
    }),
  reorderPublicationImages: (
    publicationId: string,
    imageIds: readonly string[],
  ) =>
    requestJson<{ images: PublicationImage[] }>(
      `/publications/${publicationId}/images/order`,
      { method: 'PATCH', body: JSON.stringify({ imageIds }) },
    ),
  searchPublicationsByImage: (
    image: File,
    filters: VisualSearchFilters,
    signal?: AbortSignal,
  ) => {
    const body = new FormData()
    body.append('image', image)
    if (filters.targetType) body.append('targetType', filters.targetType)
    if (filters.species) body.append('species', filters.species)
    body.append('limit', String(filters.limit))
    return requestJson<VisualSearchResponse>('/publications/search-by-image', {
      method: 'POST',
      body,
      ...(signal ? { signal } : {}),
    })
  },
}
