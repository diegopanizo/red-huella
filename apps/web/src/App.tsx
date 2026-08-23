import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from './features/auth/AuthProvider'
import { ContactSettingsFields } from './features/contacts/ContactSettingsFields'
import { PublicationContactPanel } from './features/contacts/PublicationContactPanel'
import { sanitizeReturnTo } from './features/contacts/contact-links'
import {
  contactSettingsFormSchema,
  emptyContactSettings,
  fromContactMethods,
  toContactMethods,
  type ContactSettingsFieldsValue,
} from './features/contacts/contact-settings'
import {
  ImagePicker,
  ImagePlaceholder,
  OwnerImageManager,
  PublicationGallery,
} from './features/images/PublicationImages'
import { usePendingImages } from './features/images/usePendingImages'
import { VisualSearchPage } from './features/visual-search/VisualSearchPage'
import { api, ApiError, resolveApiAssetUrl } from './services/api'
import type {
  ContactMethodType,
  Publication,
  PublicationStatus,
  PublicationType,
} from './types'
import './App.css'

const LocationPicker = React.lazy(() =>
  import('./features/locations/LocationPicker').then((module) => ({
    default: module.LocationPicker,
  })),
)
const PublicLocationMap = React.lazy(() =>
  import('./features/locations/PublicLocationMap').then((module) => ({
    default: module.PublicLocationMap,
  })),
)
const GlobalMapSection = React.lazy(() =>
  import('./features/locations/GlobalMapSection').then((module) => ({
    default: module.GlobalMapSection,
  })),
)

const labels = {
  LOST: 'Perdido',
  FOUND: 'Encontrado',
  ADOPTION: 'Adopción',
  ACTIVE: 'Activa',
  RESOLVED: 'Resuelta',
  ADOPTED: 'Adoptado',
  ARCHIVED: 'Archivada',
  DOG: 'Perro',
  CAT: 'Gato',
  OTHER: 'Otro',
  MALE: 'Macho',
  FEMALE: 'Hembra',
  UNKNOWN: 'Sexo desconocido',
} as const
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(value),
  )
const formatDistance = (meters: number) =>
  meters < 1_000
    ? 'menos de 1 km'
    : `Aprox. ${new Intl.NumberFormat('es-ES', {
        maximumFractionDigits: meters < 10_000 ? 1 : 0,
      }).format(meters / 1_000)} km`
const publicationLocationSchema = z.object({
  location: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    })
    .nullable(),
})
type PublicationLocationFields = z.infer<typeof publicationLocationSchema>

function Alert({ error }: { error: unknown }) {
  if (!error) return null
  const apiError = error instanceof ApiError ? error : undefined
  return (
    <p className="alert" role="alert">
      {apiError?.status === 403
        ? 'No tienes permiso para realizar esta acción.'
        : (apiError?.message ?? 'Ha ocurrido un error inesperado.')}
      {apiError?.requestId ? ` Referencia: ${apiError.requestId}` : ''}
    </p>
  )
}
function Spinner() {
  return (
    <p className="loading" aria-live="polite">
      Cargando…
    </p>
  )
}
function Empty({ children }: { children: string }) {
  return (
    <div className="empty">
      <span aria-hidden="true">🐾</span>
      <p>{children}</p>
    </div>
  )
}
function Layout() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <header>
        <Link className="brand" to="/">
          Red <span>Huella</span>
        </Link>
        <nav aria-label="Principal">
          <Link to="/">Explorar</Link>
          <Link to="/search-by-image">Buscar por foto</Link>
          {auth.authenticated && (
            <>
              <Link to="/my-publications">Mis publicaciones</Link>
            </>
          )}
          {auth.authenticated ? (
            <button
              className="link-button"
              onClick={() => void auth.logout().then(() => navigate('/'))}
            >
              Salir
            </button>
          ) : (
            <>
              <Link to="/login">Entrar</Link>
              <Link className="nav-cta" to="/register">
                Crear cuenta
              </Link>
            </>
          )}
          {auth.authenticated && (
            <Link className="nav-cta" to="/publications/new">
              Publicar aviso
            </Link>
          )}
        </nav>
      </header>
      <main
        id="main"
        className={location.pathname === '/' ? 'explore-main' : undefined}
      >
        <Outlet />
      </main>
      <footer>
        <strong>Red Huella</strong>
        <span>Privacidad y bienestar en cada encuentro.</span>
        <small>© 2026 Red Huella</small>
      </footer>
    </>
  )
}
function Protected() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading) return <Spinner />
  return auth.authenticated ? (
    <Outlet />
  ) : (
    <Navigate
      to={`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
      replace
    />
  )
}

function Card({
  publication,
  owner = false,
}: {
  publication: Publication
  owner?: boolean
}) {
  const [imageBroken, setImageBroken] = React.useState(false)
  const primary = [...publication.images].sort(
    (left, right) => left.position - right.position,
  )[0]
  const name = publication.animal.name ?? publication.title
  return (
    <article className="card">
      {primary && !imageBroken ? (
        <img
          className="card-image"
          src={resolveApiAssetUrl(primary.thumbnailUrl)}
          alt={`Imagen de ${name}`}
          width={primary.width ?? undefined}
          height={primary.height ?? undefined}
          loading="lazy"
          onError={() => setImageBroken(true)}
        />
      ) : (
        <div className="placeholder" aria-label="Imagen no disponible">
          <span aria-hidden="true">🐾</span>
        </div>
      )}
      <div className="card-body">
        <div className="badges">
          <span className={`badge ${publication.type.toLowerCase()}`}>
            {labels[publication.type]}
          </span>
          <span className="badge neutral">{labels[publication.status]}</span>
        </div>
        <h2>
          <Link to={`/publications/${publication.id}`}>
            {publication.animal.name ?? publication.title}
          </Link>
        </h2>
        <p>{publication.title}</p>
        <p className="card-taxonomy">
          {[
            labels[publication.type],
            labels[publication.animal.species],
            publication.animal.breed?.trim() || null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(' · ')}
        </p>
        <p className="card-secondary">
          {formatDate(publication.eventDate)} · {labels[publication.animal.sex]}
        </p>
        {(publication.publicLocation ||
          publication.distanceMeters !== undefined) && (
          <div className="card-location" aria-label="Información de ubicación">
            {publication.publicLocation && (
              <span>Zona aproximada protegida</span>
            )}
            {publication.distanceMeters !== undefined && (
              <span title="Distancia al centro de la zona pública aproximada">
                Cerca de ti · {formatDistance(publication.distanceMeters)}
              </span>
            )}
          </div>
        )}
        <p className="author">Publicado por {publication.author.name}</p>
        <div className="card-actions">
          <Link className="button" to={`/publications/${publication.id}`}>
            Ver ficha
          </Link>
          {owner && (
            <Link
              className="button secondary-link"
              to={`/publications/${publication.id}/edit`}
            >
              Editar ficha
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
function PublicationGrid({
  items,
  owner = false,
}: {
  items: Publication[]
  owner?: boolean
}) {
  return items.length ? (
    <div className="grid">
      {items.map((item) => (
        <Card key={item.id} publication={item} owner={owner} />
      ))}
    </div>
  ) : (
    <Empty>No hay publicaciones con estos filtros.</Empty>
  )
}

function HeroVisual({ publication }: { publication: Publication | undefined }) {
  const primary = publication
    ? [...publication.images].sort(
        (left, right) => left.position - right.position,
      )[0]
    : undefined
  return (
    <div className="hero-visual">
      {publication && primary ? (
        <img
          src={resolveApiAssetUrl(primary.thumbnailUrl)}
          alt={`Imagen destacada de ${publication.animal.name ?? publication.title}`}
          width={primary.width ?? undefined}
          height={primary.height ?? undefined}
        />
      ) : (
        <div
          className="hero-visual-fallback"
          aria-label="Imagen destacada no disponible"
        />
      )}
    </div>
  )
}

function Home() {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [nearby, setNearby] = React.useState<{
    latitude: number
    longitude: number
    radiusMeters: number
  } | null>(null)
  const [geolocationStatus, setGeolocationStatus] = React.useState<
    'idle' | 'loading'
  >('idle')
  const [geolocationError, setGeolocationError] = React.useState<string>()
  const requestParams = new URLSearchParams(params)
  if (nearby) {
    requestParams.set('latitude', String(nearby.latitude))
    requestParams.set('longitude', String(nearby.longitude))
    requestParams.set('radiusMeters', String(nearby.radiusMeters))
    requestParams.set('order', 'distance')
  }
  const query = requestParams.toString()
  const result = useQuery({
    queryKey: [
      'publications',
      {
        filters: params.toString(),
        latitude: nearby?.latitude ?? null,
        longitude: nearby?.longitude ?? null,
        radiusMeters: nearby?.radiusMeters ?? null,
        order: nearby ? 'distance' : (params.get('order') ?? 'newest'),
        page: Number(params.get('page') ?? 1),
      },
    ],
    queryFn: () => api.publications(query),
  })
  const page = Number(params.get('page') ?? 1)
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setParams(next)
  }
  const searchNearby = () => {
    if (!navigator.geolocation) return
    setGeolocationStatus('loading')
    setGeolocationError(undefined)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNearby({
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusMeters: 25_000,
        })
        update('page', '1')
        setGeolocationStatus('idle')
      },
      (error) => {
        setGeolocationStatus('idle')
        setGeolocationError(
          error.code === 1
            ? 'Permiso de ubicación denegado. El listado normal sigue disponible.'
            : error.code === 3
              ? 'La geolocalización tardó demasiado. Puedes volver a intentarlo.'
              : 'No se pudo obtener tu ubicación. El listado normal sigue disponible.',
        )
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }
  const removeNearby = () => {
    setNearby(null)
    setGeolocationError(undefined)
    queryClient.removeQueries({
      queryKey: ['publications'],
      predicate: (query) => {
        const state = query.queryKey[1]
        return (
          typeof state === 'object' &&
          state !== null &&
          'latitude' in state &&
          state.latitude !== null
        )
      },
    })
    update('page', '1')
  }
  const mapType = params.get('type')
  const mapSpecies = params.get('species')
  const mapStatus = params.get('status')
  const mapFilters: {
    type?: PublicationType
    species?: 'DOG' | 'CAT' | 'OTHER'
    status?: 'ACTIVE' | 'RESOLVED' | 'ADOPTED'
  } = {
    ...(mapType === 'LOST' || mapType === 'FOUND' || mapType === 'ADOPTION'
      ? { type: mapType }
      : {}),
    ...(mapSpecies === 'DOG' || mapSpecies === 'CAT' || mapSpecies === 'OTHER'
      ? { species: mapSpecies }
      : {}),
    ...(mapStatus === 'ACTIVE' ||
    mapStatus === 'RESOLVED' ||
    mapStatus === 'ADOPTED'
      ? { status: mapStatus }
      : {}),
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Personas y animales, más cerca</p>
          <h1>Ayudamos a que cada huella vuelva a casa.</h1>
          <p>
            Encuentra animales perdidos, encontrados y en adopción cerca de ti.
          </p>
          <div className="hero-actions">
            <a className="button" href="#publications-title">
              Explorar publicaciones
            </a>
            <Link className="button secondary-link" to="/publications/new">
              Publicar un aviso
            </Link>
          </div>
        </div>
        <HeroVisual publication={result.data?.items[0]} />
      </section>
      <section aria-labelledby="publications-title">
        <div className="section-title">
          <div>
            <h2 id="publications-title">Explorar publicaciones</h2>
            <p>Encuentra animales perdidos, encontrados y en adopción.</p>
          </div>
          <Link className="button" to="/publications/new">
            Publicar aviso
          </Link>
        </div>
        <div className="explore-toolbar">
          <div className="filters">
            <label>
              Tipo
              <select
                value={params.get('type') ?? ''}
                onChange={(e) => update('type', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="LOST">Perdidos</option>
                <option value="FOUND">Encontrados</option>
                <option value="ADOPTION">Adopción</option>
              </select>
            </label>
            <label>
              Especie
              <select
                value={params.get('species') ?? ''}
                onChange={(e) => update('species', e.target.value)}
              >
                <option value="">Todas</option>
                <option value="DOG">Perro</option>
                <option value="CAT">Gato</option>
                <option value="OTHER">Otra</option>
              </select>
            </label>
            <label>
              Estado
              <select
                value={params.get('status') ?? ''}
                onChange={(e) => update('status', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="ACTIVE">Activas</option>
                <option value="RESOLVED">Resueltas</option>
                <option value="ADOPTED">Adoptadas</option>
              </select>
            </label>
            <label>
              Orden
              <select
                value={nearby ? 'distance' : (params.get('order') ?? 'newest')}
                onChange={(e) => update('order', e.target.value)}
                disabled={nearby !== null}
              >
                {nearby && <option value="distance">Cercanía</option>}
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguas</option>
                <option value="eventDate">Fecha del suceso</option>
              </select>
            </label>
          </div>
          <div className="nearby-search">
            {nearby ? (
              <>
                <div>
                  <strong>Cerca de mí · {nearby.radiusMeters / 1000} km</strong>
                  <span>Ordenadas por cercanía</span>
                </div>
                <label>
                  Radio
                  <select
                    value={nearby.radiusMeters}
                    onChange={(event) => {
                      const radiusMeters = Number(event.target.value)
                      setNearby({ ...nearby, radiusMeters })
                      update('page', '1')
                    }}
                  >
                    <option value="5000">5 km</option>
                    <option value="10000">10 km</option>
                    <option value="25000">25 km</option>
                    <option value="50000">50 km</option>
                    <option value="100000">100 km</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={removeNearby}
                >
                  Desactivar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={searchNearby}
                disabled={
                  !navigator.geolocation || geolocationStatus === 'loading'
                }
              >
                {!navigator.geolocation
                  ? 'Cercanía no disponible'
                  : geolocationStatus === 'loading'
                    ? 'Obteniendo ubicación…'
                    : 'Cerca de mí'}
              </button>
            )}
          </div>
        </div>
        {geolocationError && (
          <p className="alert" role="alert">
            {geolocationError}
          </p>
        )}
        {result.isLoading ? (
          <Spinner />
        ) : result.isError ? (
          <Alert error={result.error} />
        ) : (
          <>
            <PublicationGrid items={result.data?.items ?? []} />
            <nav className="pagination" aria-label="Paginación">
              <button
                disabled={page <= 1}
                onClick={() => update('page', String(page - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} de{' '}
                {Math.max(1, result.data?.pagination.totalPages ?? 1)}
              </span>
              <button
                disabled={page >= (result.data?.pagination.totalPages ?? 1)}
                onClick={() => update('page', String(page + 1))}
              >
                Siguiente
              </button>
            </nav>
          </>
        )}
      </section>
      <section
        className="global-map-section"
        aria-labelledby="global-map-title"
      >
        <div className="section-title">
          <div>
            <p className="eyebrow">Vista geográfica</p>
            <h2 id="global-map-title">Mapa de publicaciones</h2>
          </div>
        </div>
        <React.Suspense
          fallback={
            <p className="loading" aria-live="polite">
              Preparando mapa…
            </p>
          }
        >
          <GlobalMapSection filters={mapFilters} nearbyArea={nearby} />
        </React.Suspense>
      </section>
    </>
  )
}

const authSchema = z
  .object({
    name: z.string().trim().min(1, 'Introduce tu nombre').optional(),
    email: z.email('Introduce un email válido'),
    password: z.string().min(12, 'Mínimo 12 caracteres').max(128),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (value) =>
      !value.confirmPassword || value.password === value.confirmPassword,
    { path: ['confirmPassword'], message: 'Las contraseñas no coinciden' },
  )
type AuthFields = z.infer<typeof authSchema>
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | undefined
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small role="alert">{error}</small>}
    </label>
  )
}
function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'))
  const [serverError, setServerError] = React.useState<unknown>()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AuthFields>({ resolver: zodResolver(authSchema) })
  const submit = handleSubmit(async (values) => {
    try {
      if (mode === 'register')
        await auth.register(values.name ?? '', values.email, values.password)
      else await auth.login(values.email, values.password)
      reset()
      navigate(returnTo, { replace: true })
    } catch (error) {
      setServerError(error)
    }
  })
  return (
    <section className="auth-panel">
      <div>
        <p className="eyebrow">
          {mode === 'login' ? 'Bienvenido de nuevo' : 'Únete a la red'}
        </p>
        <h1>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
        <p>
          {mode === 'login'
            ? 'Continúa ayudando a que más animales vuelvan a casa.'
            : 'Publica avisos y gestiona su evolución de forma segura.'}
        </p>
      </div>
      <form onSubmit={(event) => void submit(event)} noValidate>
        {mode === 'register' && (
          <Field label="Nombre" error={errors.name?.message}>
            <input autoComplete="name" {...register('name')} />
          </Field>
        )}
        <Field label="Email" error={errors.email?.message}>
          <input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          <input
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            {...register('password')}
          />
        </Field>
        {mode === 'register' && (
          <Field
            label="Repite la contraseña"
            error={errors.confirmPassword?.message}
          >
            <input
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          </Field>
        )}
        <Alert error={serverError} />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Enviando…'
            : mode === 'login'
              ? 'Entrar'
              : 'Crear cuenta'}
        </button>
        <p>
          {mode === 'login' ? (
            <>
              ¿Aún no tienes cuenta? <Link to="/register">Regístrate</Link>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta? <Link to="/login">Entra</Link>
            </>
          )}
        </p>
      </form>
    </section>
  )
}

function validStatuses(
  type: PublicationType,
): { value: PublicationStatus; label: string }[] {
  return [
    {
      value: type === 'ADOPTION' ? 'ADOPTED' : 'RESOLVED',
      label: type === 'ADOPTION' ? 'Marcar adoptado' : 'Marcar resuelto',
    },
    { value: 'ARCHIVED', label: 'Archivar' },
  ]
}
function Detail() {
  const { id = '' } = useParams()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const result = useQuery({
    queryKey: ['publication', id],
    queryFn: () => api.publication(id),
    retry: false,
  })
  const archivedOwnerResult = useQuery({
    queryKey: ['my-publications'],
    queryFn: api.mine,
    enabled:
      auth.authenticated &&
      result.error instanceof ApiError &&
      result.error.status === 404,
  })
  const status = useMutation({
    mutationFn: (target: PublicationStatus) => api.changeStatus(id, target),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['publication', id] })
      await queryClient.invalidateQueries({ queryKey: ['my-publications'] })
    },
  })
  if (result.isLoading || archivedOwnerResult.isLoading) return <Spinner />
  if (
    result.isError &&
    !(result.error instanceof ApiError && result.error.status === 404)
  )
    return <Alert error={result.error} />
  if (archivedOwnerResult.isError)
    return <Alert error={archivedOwnerResult.error} />
  const item =
    result.data?.publication ??
    archivedOwnerResult.data?.items.find((publication) => publication.id === id)
  if (!item) return <NotFound />
  const owner = auth.user?.id === item.author.id
  return (
    <article className="detail">
      <Link to="/">← Volver a explorar</Link>
      <div className="detail-grid">
        {item.images.length > 0 ? (
          <PublicationGallery publication={item} />
        ) : (
          <ImagePlaceholder />
        )}
        <div>
          <div className="badges">
            <span className={`badge ${item.type.toLowerCase()}`}>
              {labels[item.type]}
            </span>
            <span className="badge neutral">{labels[item.status]}</span>
          </div>
          <h1>{item.title}</h1>
          <p className="lead">
            {item.description ?? 'Sin descripción adicional.'}
          </p>
          <dl className="facts">
            <div>
              <dt>Animal</dt>
              <dd>{item.animal.name ?? 'Sin nombre'}</dd>
            </div>
            <div>
              <dt>Especie</dt>
              <dd>{labels[item.animal.species]}</dd>
            </div>
            {item.animal.breed?.trim() && (
              <div>
                <dt>Raza</dt>
                <dd>{item.animal.breed}</dd>
              </div>
            )}
            <div>
              <dt>Sexo</dt>
              <dd>{labels[item.animal.sex]}</dd>
            </div>
            <div>
              <dt>Fecha del suceso</dt>
              <dd>{formatDate(item.eventDate)}</dd>
            </div>
            <div>
              <dt>Autor</dt>
              <dd>{item.author.name}</dd>
            </div>
            {item.publicLocation && (
              <div>
                <dt>Ubicación</dt>
                <dd>Zona aproximada protegida</dd>
              </div>
            )}
            {item.resolvedAt && (
              <div>
                <dt>Finalizada</dt>
                <dd>{formatDate(item.resolvedAt)}</dd>
              </div>
            )}
          </dl>
          {item.publicLocation && (
            <React.Suspense fallback={<Spinner />}>
              <PublicLocationMap
                publicLocation={item.publicLocation}
                type={item.type}
              />
            </React.Suspense>
          )}
          {owner && item.status === 'ACTIVE' && (
            <div className="actions">
              <button onClick={() => navigate(`/publications/${id}/edit`)}>
                Editar
              </button>
              {validStatuses(item.type).map((option) => (
                <button
                  className="secondary"
                  key={option.value}
                  onClick={() =>
                    window.confirm(`¿Confirmas: ${option.label}?`) &&
                    status.mutate(option.value)
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <Alert error={status.error} />
          <PublicationContactPanel
            publicationId={item.id}
            publicationStatus={item.status}
            {...(item.animal.name ? { animalName: item.animal.name } : {})}
          />
        </div>
      </div>
      {owner && <OwnerImageManager publication={item} />}
    </article>
  )
}

function PublicationForm({ edit = false }: { edit?: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const client = useQueryClient()
  const pendingImages = usePendingImages()
  const contactForm = useForm<ContactSettingsFieldsValue>({
    resolver: zodResolver(contactSettingsFormSchema),
    defaultValues: emptyContactSettings,
  })
  const [publicationType, setPublicationType] =
    React.useState<PublicationType>('LOST')
  const locationForm = useForm<PublicationLocationFields>({
    resolver: zodResolver(publicationLocationSchema),
    defaultValues: { location: null },
  })
  const selectedLocation =
    useWatch({ control: locationForm.control, name: 'location' }) ?? null
  const [locationIntent, setLocationIntent] = React.useState<
    'unchanged' | 'set' | 'remove'
  >('unchanged')
  const [locationError, setLocationError] = React.useState<string>()
  const initializedPublication = React.useRef<string | undefined>(undefined)
  const initializedContact = React.useRef<string | undefined>(undefined)
  const [createdPublicationId, setCreatedPublicationId] =
    React.useState<string>()
  const [contactSaveError, setContactSaveError] = React.useState<unknown>()
  const [imageUploadError, setImageUploadError] = React.useState<unknown>()
  const desiredContactMethods = React.useRef<
    ReturnType<typeof toContactMethods>
  >([])
  const [contactRetryNeeded, setContactRetryNeeded] = React.useState(false)
  const [imageRetryNeeded, setImageRetryNeeded] = React.useState(false)
  const existing = useQuery({
    queryKey: ['publication-manage', id],
    queryFn: () => api.managePublication(id),
    enabled: edit,
    retry: false,
  })
  const contactSettings = useQuery({
    queryKey: ['contact-settings', id],
    queryFn: () => api.getPublicationContactSettings(id),
    enabled: edit,
    retry: false,
    staleTime: 0,
  })
  const statusMutation = useMutation({
    mutationFn: (target: PublicationStatus) => api.changeStatus(id, target),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['publication-manage', id] }),
        client.invalidateQueries({ queryKey: ['publication', id] }),
        client.invalidateQueries({ queryKey: ['my-publications'] }),
      ])
      navigate(`/publications/${id}`)
    },
  })
  React.useEffect(() => {
    const item = existing.data?.publication
    if (!item || initializedPublication.current === item.id) return
    initializedPublication.current = item.id
    setPublicationType(item.type)
    locationForm.reset({
      location: item.type === 'ADOPTION' ? null : item.exactLocation,
    })
    setLocationIntent('unchanged')
  }, [existing.data, locationForm])
  React.useEffect(() => {
    const settings = contactSettings.data?.contactSettings
    if (!settings || initializedContact.current === id) return
    initializedContact.current = id
    contactForm.reset(fromContactMethods(settings.methods))
  }, [contactForm, contactSettings.data, id])
  React.useEffect(
    () => () => {
      if (edit) client.removeQueries({ queryKey: ['contact-settings', id] })
    },
    [client, edit, id],
  )
  const mutation = useMutation({
    mutationFn: async ({
      body,
      methods,
    }: {
      body: unknown
      methods: ReturnType<typeof toContactMethods>
    }) => {
      if (edit) {
        const [updated] = await Promise.all([
          api.updatePublication(id, body),
          api.replacePublicationContactSettings(id, { methods }),
        ])
        return { ...updated, complete: true }
      }
      const created = await api.createPublication(body)
      setCreatedPublicationId(created.publication.id)
      desiredContactMethods.current = methods
      const [contactResult, imageResult] = await Promise.allSettled([
        methods.length > 0
          ? api.replacePublicationContactSettings(created.publication.id, {
              methods,
            })
          : Promise.resolve(undefined),
        pendingImages.images.length > 0
          ? api.uploadPublicationImages(
              created.publication.id,
              pendingImages.images.map((image) => image.file),
            )
          : Promise.resolve(undefined),
      ])
      const needsContactRetry = contactResult.status === 'rejected'
      const needsImageRetry = imageResult.status === 'rejected'
      setContactRetryNeeded(needsContactRetry)
      setImageRetryNeeded(needsImageRetry)
      setContactSaveError(
        contactResult.status === 'rejected' ? contactResult.reason : undefined,
      )
      setImageUploadError(
        imageResult.status === 'rejected' ? imageResult.reason : undefined,
      )
      if (imageResult.status === 'fulfilled') pendingImages.clear()
      return { ...created, complete: !needsContactRetry && !needsImageRetry }
    },
    onSuccess: async ({ publication, complete }) => {
      await client.invalidateQueries({ queryKey: ['publications'] })
      await client.invalidateQueries({ queryKey: ['my-publications'] })
      if (complete) navigate(`/publications/${publication.id}`)
    },
  })
  const retryUpload = useMutation({
    mutationFn: async () => {
      if (!createdPublicationId)
        throw new Error('No existe una publicación para reintentar')
      return api.uploadPublicationImages(
        createdPublicationId,
        pendingImages.images.map((image) => image.file),
      )
    },
    onSuccess: async () => {
      if (!createdPublicationId) return
      pendingImages.clear()
      setImageRetryNeeded(false)
      setImageUploadError(undefined)
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['publication', createdPublicationId],
        }),
        client.invalidateQueries({ queryKey: ['publications'] }),
        client.invalidateQueries({ queryKey: ['my-publications'] }),
      ])
      if (!contactRetryNeeded) navigate(`/publications/${createdPublicationId}`)
    },
  })
  const retryContact = useMutation({
    mutationFn: async () => {
      if (!createdPublicationId)
        throw new Error('No existe una publicación para reintentar')
      return api.replacePublicationContactSettings(createdPublicationId, {
        methods: desiredContactMethods.current,
      })
    },
    onSuccess: () => {
      setContactRetryNeeded(false)
      setContactSaveError(undefined)
      if (!imageRetryNeeded && createdPublicationId)
        navigate(`/publications/${createdPublicationId}`)
    },
  })
  if (edit && (existing.isLoading || contactSettings.isLoading))
    return <Spinner />
  if (edit && (existing.isError || contactSettings.isError))
    return <Alert error={existing.error ?? contactSettings.error} />
  if (
    edit &&
    existing.data &&
    existing.data.publication.author.id !== auth.user?.id
  )
    return (
      <Alert
        error={
          new ApiError(
            403,
            'PUBLICATION_FORBIDDEN',
            'No tienes permiso para editar esta publicación.',
          )
        }
      />
    )
  const item = existing.data?.publication
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createdPublicationId) return
    const formElement = event.currentTarget
    if (!(await contactForm.trigger())) return
    const methods = toContactMethods(contactForm.getValues())
    const form = new FormData(formElement)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    const nullable = (name: string) => value(name) || null
    if (
      edit &&
      item?.type === 'ADOPTION' &&
      publicationType !== 'ADOPTION' &&
      locationIntent === 'unchanged'
    ) {
      setLocationError(
        'Selecciona una ubicación exacta nueva o confirma Quitar ubicación antes de cambiar desde adopción.',
      )
      return
    }
    setLocationError(undefined)
    const animal = {
      name: nullable('animalName'),
      species: value('species'),
      breed: nullable('breed'),
      sex: value('sex'),
      color: nullable('color'),
      size: value('size'),
      approximateAge: value('approximateAge')
        ? Number(value('approximateAge'))
        : null,
      description: nullable('animalDescription'),
    }
    const body = edit
      ? {
          type: publicationType,
          title: value('title'),
          description: nullable('description'),
          eventDate: new Date(value('eventDate')).toISOString(),
          ...(locationIntent === 'set'
            ? { location: selectedLocation }
            : locationIntent === 'remove'
              ? { location: null }
              : {}),
          animal,
        }
      : {
          type: publicationType,
          title: value('title'),
          description: nullable('description'),
          eventDate: new Date(value('eventDate')).toISOString(),
          ...(selectedLocation ? { location: selectedLocation } : {}),
          animal,
        }
    mutation.mutate({ body, methods })
  }
  return (
    <section className="form-page">
      <p className="eyebrow">
        {edit ? 'Gestiona tu aviso' : 'Nueva publicación'}
      </p>
      <h1>{edit ? 'Editar publicación' : 'Publica una huella'}</h1>
      <p>
        Los campos marcados son obligatorios. El backend volverá a validar todos
        los datos.
      </p>
      {edit && item?.status === 'ACTIVE' && (
        <section
          className="edit-status-panel"
          aria-labelledby="edit-status-title"
        >
          <div>
            <h2 id="edit-status-title">Estado de la ficha</h2>
            <p>Actualmente está activa. Puedes finalizarla o archivarla.</p>
          </div>
          <div className="actions">
            {validStatuses(item.type).map((option) => (
              <button
                type="button"
                className="secondary"
                key={option.value}
                disabled={statusMutation.isPending}
                onClick={() =>
                  window.confirm(`¿Confirmas: ${option.label}?`) &&
                  statusMutation.mutate(option.value)
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      )}
      <Alert error={statusMutation.error} />
      <form onSubmit={submit}>
        <fieldset>
          <legend>Publicación</legend>
          <Field label="Tipo">
            <select
              name="type"
              required
              value={publicationType}
              onChange={(event) => {
                const next = event.target.value as PublicationType
                setPublicationType(next)
                setLocationError(undefined)
                if (item?.type === 'ADOPTION' && next !== 'ADOPTION') {
                  locationForm.reset({ location: null })
                  setLocationIntent('unchanged')
                }
              }}
            >
              <option value="LOST">Perdido</option>
              <option value="FOUND">Encontrado</option>
              <option value="ADOPTION">Adopción</option>
            </select>
          </Field>
          <Field label="Título">
            <input
              name="title"
              required
              minLength={5}
              maxLength={160}
              defaultValue={item?.title}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              name="description"
              maxLength={5000}
              defaultValue={item?.description ?? ''}
            />
          </Field>
          <Field label="Fecha y hora">
            <input
              name="eventDate"
              type="datetime-local"
              required
              defaultValue={item ? item.eventDate.slice(0, 16) : ''}
            />
          </Field>
        </fieldset>
        {item?.type !== 'ADOPTION' && publicationType === 'ADOPTION' && (
          <p className="privacy-transition">
            Al guardar, esta ubicación pasará a tratarse como zona de referencia
            y el backend dejará de conservarla como punto exacto.
          </p>
        )}
        <React.Suspense fallback={<Spinner />}>
          <LocationPicker
            mode={
              publicationType === 'ADOPTION' ? 'reference-zone' : 'exact-owner'
            }
            value={selectedLocation}
            publicZone={edit ? item?.publicLocation : null}
            privacyText={
              publicationType === 'LOST'
                ? 'La ubicación exacta se guarda de forma privada. Los demás usuarios verán una zona aproximada de 1 km.'
                : publicationType === 'FOUND'
                  ? 'La ubicación exacta se guarda de forma privada. Los demás usuarios verán una zona aproximada de 1,5 km.'
                  : 'No publiques tu domicilio exacto. Selecciona una zona de referencia. Se mostrará una zona aproximada de 5 km.'
            }
            onChange={(next) => {
              locationForm.setValue('location', next, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setLocationIntent(next ? 'set' : 'remove')
              setLocationError(undefined)
            }}
          />
        </React.Suspense>
        {locationError && (
          <p className="alert" role="alert">
            {locationError}
          </p>
        )}
        <fieldset>
          <legend>Animal</legend>
          <Field label="Nombre">
            <input
              name="animalName"
              maxLength={120}
              defaultValue={item?.animal.name ?? ''}
            />
          </Field>
          <div className="two">
            <Field label="Especie">
              <select
                name="species"
                required
                defaultValue={item?.animal.species ?? 'DOG'}
              >
                <option value="DOG">Perro</option>
                <option value="CAT">Gato</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>
            <Field label="Raza">
              <input
                name="breed"
                maxLength={120}
                defaultValue={item?.animal.breed ?? ''}
              />
            </Field>
            <Field label="Sexo">
              <select name="sex" defaultValue={item?.animal.sex ?? 'UNKNOWN'}>
                <option value="UNKNOWN">Desconocido</option>
                <option value="MALE">Macho</option>
                <option value="FEMALE">Hembra</option>
              </select>
            </Field>
            <Field label="Tamaño">
              <select name="size" defaultValue={item?.animal.size ?? 'UNKNOWN'}>
                <option value="UNKNOWN">Desconocido</option>
                <option value="SMALL">Pequeño</option>
                <option value="MEDIUM">Mediano</option>
                <option value="LARGE">Grande</option>
              </select>
            </Field>
            <Field label="Color">
              <input
                name="color"
                maxLength={120}
                defaultValue={item?.animal.color ?? ''}
              />
            </Field>
            <Field label="Edad aproximada (meses)">
              <input
                name="approximateAge"
                type="number"
                min="0"
                max="600"
                defaultValue={item?.animal.approximateAge ?? ''}
              />
            </Field>
          </div>
          <Field label="Descripción del animal">
            <textarea
              name="animalDescription"
              maxLength={5000}
              defaultValue={item?.animal.description ?? ''}
            />
          </Field>
        </fieldset>
        <ContactSettingsFields
          form={contactForm}
          {...(item ? { status: item.status } : {})}
          {...(edit
            ? {
                originalMethods: new Set<ContactMethodType>(
                  (contactSettings.data?.contactSettings?.methods ?? []).map(
                    (method) => method.type,
                  ),
                ),
              }
            : {})}
        />
        {!edit && (
          <ImagePicker
            pending={pendingImages}
            disabled={mutation.isPending || retryUpload.isPending}
          />
        )}
        {createdPublicationId && (contactRetryNeeded || imageRetryNeeded) && (
          <div className="partial-success" role="alert">
            <strong>La publicación se ha creado.</strong>
            {contactRetryNeeded && (
              <p>
                El contacto no pudo guardarse. Puedes reintentarlo sin crear
                otra publicación.
              </p>
            )}
            {imageRetryNeeded && (
              <p>
                Las imágenes no pudieron subirse. Puedes reintentarlo sin crear
                otra publicación.
              </p>
            )}
            <div className="actions">
              {contactRetryNeeded && (
                <button
                  type="button"
                  disabled={retryContact.isPending}
                  onClick={() => retryContact.mutate()}
                >
                  {retryContact.isPending
                    ? 'Reintentando…'
                    : 'Reintentar contacto'}
                </button>
              )}
              {imageRetryNeeded && (
                <button
                  type="button"
                  disabled={retryUpload.isPending}
                  onClick={() => retryUpload.mutate()}
                >
                  {retryUpload.isPending
                    ? 'Reintentando…'
                    : 'Reintentar imágenes'}
                </button>
              )}
              <Link
                className="button secondary-link"
                to={`/publications/${createdPublicationId}`}
              >
                Ir a la publicación
              </Link>
            </div>
          </div>
        )}
        <Alert error={mutation.error} />
        <Alert error={contactSaveError ?? retryContact.error} />
        <Alert error={imageUploadError ?? retryUpload.error} />
        <button
          type="submit"
          disabled={
            mutation.isPending ||
            retryUpload.isPending ||
            retryContact.isPending ||
            Boolean(createdPublicationId)
          }
        >
          {mutation.isPending || retryUpload.isPending || retryContact.isPending
            ? 'Guardando…'
            : createdPublicationId
              ? 'Publicación creada'
              : edit
                ? 'Guardar cambios'
                : 'Guardar publicación'}
        </button>
      </form>
    </section>
  )
}
function Mine() {
  const result = useQuery({ queryKey: ['my-publications'], queryFn: api.mine })
  return (
    <section>
      <div className="section-title">
        <div>
          <p className="eyebrow">Tu actividad</p>
          <h1>Mis publicaciones</h1>
        </div>
        <Link className="button" to="/publications/new">
          Nueva publicación
        </Link>
      </div>
      {result.isLoading ? (
        <Spinner />
      ) : result.isError ? (
        <Alert error={result.error} />
      ) : (
        <PublicationGrid items={result.data?.items ?? []} owner />
      )}
    </section>
  )
}
function NotFound() {
  return (
    <section className="not-found">
      <span aria-hidden="true">🐾</span>
      <h1>No encontramos esta huella</h1>
      <p>La página no existe o la publicación ya no está disponible.</p>
      <Link className="button" to="/">
        Volver al inicio
      </Link>
    </section>
  )
}
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="publications/:id" element={<Detail />} />
        <Route element={<Protected />}>
          <Route path="search-by-image" element={<VisualSearchPage />} />
          <Route path="publications/new" element={<PublicationForm />} />
          <Route
            path="publications/:id/edit"
            element={<PublicationForm edit />}
          />
          <Route path="my-publications" element={<Mine />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
