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
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from './features/auth/AuthProvider'
import {
  ImagePicker,
  ImagePlaceholder,
  OwnerImageManager,
  PublicationGallery,
} from './features/images/PublicationImages'
import { usePendingImages } from './features/images/usePendingImages'
import { api, ApiError, resolveApiAssetUrl } from './services/api'
import type { Publication, PublicationStatus, PublicationType } from './types'
import './App.css'

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
} as const
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(value),
  )

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
          {auth.authenticated && (
            <>
              <Link to="/publications/new">Publicar</Link>
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
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer>Red Huella · Una comunidad para volver a encontrarnos.</footer>
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
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  )
}

function Card({ publication }: { publication: Publication }) {
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
        <dl>
          <div>
            <dt>Especie</dt>
            <dd>{labels[publication.animal.species]}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{formatDate(publication.eventDate)}</dd>
          </div>
        </dl>
        <p className="author">Publicado por {publication.author.name}</p>
      </div>
    </article>
  )
}
function PublicationGrid({ items }: { items: Publication[] }) {
  return items.length ? (
    <div className="grid">
      {items.map((item) => (
        <Card key={item.id} publication={item} />
      ))}
    </div>
  ) : (
    <Empty>No hay publicaciones con estos filtros.</Empty>
  )
}

function Home() {
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const result = useQuery({
    queryKey: ['publications', query],
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
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Personas y animales, más cerca</p>
        <h1>Ayudamos a que cada huella vuelva a casa.</h1>
        <p>Explora avisos de animales perdidos, encontrados y en adopción.</p>
        <div className="hero-actions">
          <button onClick={() => update('type', 'LOST')}>Ver perdidos</button>
          <button className="secondary" onClick={() => update('type', 'FOUND')}>
            Ver encontrados
          </button>
          <button
            className="secondary"
            onClick={() => update('type', 'ADOPTION')}
          >
            Ver adopciones
          </button>
        </div>
      </section>
      <section aria-labelledby="publications-title">
        <div className="section-title">
          <div>
            <p className="eyebrow">Últimas huellas</p>
            <h2 id="publications-title">Publicaciones</h2>
          </div>
          <Link className="button" to="/publications/new">
            Publicar aviso
          </Link>
        </div>
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
            Orden
            <select
              value={params.get('order') ?? 'newest'}
              onChange={(e) => update('order', e.target.value)}
            >
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguas</option>
              <option value="eventDate">Fecha del suceso</option>
            </select>
          </label>
        </div>
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
      navigate('/')
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
            <div>
              <dt>Fecha del suceso</dt>
              <dd>{formatDate(item.eventDate)}</dd>
            </div>
            <div>
              <dt>Autor</dt>
              <dd>{item.author.name}</dd>
            </div>
            {item.location && (
              <div>
                <dt>Ubicación provisional</dt>
                <dd>
                  {item.location.latitude}, {item.location.longitude}
                </dd>
              </div>
            )}
            {item.resolvedAt && (
              <div>
                <dt>Finalizada</dt>
                <dd>{formatDate(item.resolvedAt)}</dd>
              </div>
            )}
          </dl>
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
  const [createdPublicationId, setCreatedPublicationId] =
    React.useState<string>()
  const existing = useQuery({
    queryKey: ['publication', id],
    queryFn: () => api.publication(id),
    enabled: edit,
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: async (body: unknown) => {
      if (edit) return api.updatePublication(id, body)
      const created = await api.createPublication(body)
      setCreatedPublicationId(created.publication.id)
      if (pendingImages.images.length > 0)
        await api.uploadPublicationImages(
          created.publication.id,
          pendingImages.images.map((image) => image.file),
        )
      return created
    },
    onSuccess: async ({ publication }) => {
      pendingImages.clear()
      await client.invalidateQueries({ queryKey: ['publications'] })
      await client.invalidateQueries({ queryKey: ['my-publications'] })
      navigate(`/publications/${publication.id}`)
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
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['publication', createdPublicationId],
        }),
        client.invalidateQueries({ queryKey: ['publications'] }),
        client.invalidateQueries({ queryKey: ['my-publications'] }),
      ])
      navigate(`/publications/${createdPublicationId}`)
    },
  })
  if (edit && existing.isLoading) return <Spinner />
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
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createdPublicationId) {
      retryUpload.mutate()
      return
    }
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    const nullable = (name: string) => value(name) || null
    const location =
      value('latitude') && value('longitude')
        ? {
            latitude: Number(value('latitude')),
            longitude: Number(value('longitude')),
          }
        : null
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
          title: value('title'),
          description: nullable('description'),
          eventDate: new Date(value('eventDate')).toISOString(),
          location,
          animal,
        }
      : {
          type: value('type'),
          title: value('title'),
          description: nullable('description'),
          eventDate: new Date(value('eventDate')).toISOString(),
          location,
          animal,
        }
    mutation.mutate(body)
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
      <form onSubmit={submit}>
        <fieldset>
          <legend>Publicación</legend>
          {!edit && (
            <Field label="Tipo">
              <select name="type" required defaultValue="LOST">
                <option value="LOST">Perdido</option>
                <option value="FOUND">Encontrado</option>
                <option value="ADOPTION">Adopción</option>
              </select>
            </Field>
          )}
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
          <div className="two">
            <Field label="Latitud">
              <input
                name="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                defaultValue={item?.location?.latitude}
              />
            </Field>
            <Field label="Longitud">
              <input
                name="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                defaultValue={item?.location?.longitude ?? undefined}
              />
            </Field>
          </div>
          <small>
            La selección visual mediante mapa se añadirá próximamente. Las
            coordenadas actuales son provisionales.
          </small>
        </fieldset>
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
        {!edit && (
          <ImagePicker
            pending={pendingImages}
            disabled={mutation.isPending || retryUpload.isPending}
          />
        )}
        {createdPublicationId && mutation.isError && (
          <div className="partial-success" role="alert">
            <strong>La publicación se ha creado.</strong>
            <p>
              Las imágenes no pudieron subirse. Puedes reintentarlo sin crear
              otra publicación o abrir el detalle ahora.
            </p>
            <div className="actions">
              <button
                type="button"
                disabled={retryUpload.isPending}
                onClick={() => retryUpload.mutate()}
              >
                {retryUpload.isPending
                  ? 'Reintentando…'
                  : 'Reintentar imágenes'}
              </button>
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
        <Alert error={retryUpload.error} />
        <button
          type="submit"
          disabled={mutation.isPending || retryUpload.isPending}
        >
          {mutation.isPending || retryUpload.isPending
            ? 'Guardando…'
            : createdPublicationId
              ? 'Reintentar imágenes'
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
        <PublicationGrid items={result.data?.items ?? []} />
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
