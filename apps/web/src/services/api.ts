import type {
  Publication,
  PublicationImage,
  PublicationList,
  User,
} from '../types'

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
  return new URL(path, new URL(apiUrl).origin).toString()
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
  mine: () => requestJson<PublicationList>('/publications/mine?pageSize=100'),
  publication: (id: string) =>
    requestJson<{ publication: Publication }>(`/publications/${id}`),
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
}
