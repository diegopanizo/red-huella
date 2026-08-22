import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import { api, ApiError } from '../../services/api'
import type { PublicationStatus } from '../../types'
import {
  buildEmailContactUrl,
  buildTelephoneContactUrl,
  buildWhatsAppContactUrl,
} from './contact-links'

type Props = {
  publicationId: string
  publicationStatus: PublicationStatus
  animalName?: string | undefined
}

export function PublicationContactPanel({
  publicationId,
  publicationStatus,
  animalName,
}: Props) {
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const queryKey = ['publication-contact', publicationId] as const
  const contact = useQuery({
    queryKey,
    queryFn: () => api.getPublicationContact(publicationId),
    enabled: false,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })

  useEffect(
    () => () =>
      client.removeQueries({
        queryKey: ['publication-contact', publicationId],
      }),
    [client, publicationId],
  )

  if (publicationStatus !== 'ACTIVE') return null

  const reveal = () => {
    if (!auth.authenticated) {
      const returnTo = `/publications/${publicationId}`
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }
    setRevealed(true)
    void contact.refetch()
  }
  const hide = () => {
    setRevealed(false)
    client.removeQueries({ queryKey })
  }
  const error = contact.error instanceof ApiError ? contact.error : undefined
  const methods = contact.data?.contact.methods ?? []

  return (
    <section className="contact-panel" aria-labelledby="contact-panel-title">
      <h2 id="contact-panel-title">Contactar con quien publicó</h2>
      <p>
        Los datos de contacto solo se muestran a usuarios con sesión iniciada.
      </p>
      {!revealed && (
        <button type="button" disabled={auth.loading} onClick={reveal}>
          Ver opciones de contacto
        </button>
      )}
      {revealed && contact.isFetching && (
        <p aria-live="polite">Cargando opciones de contacto…</p>
      )}
      {revealed && !contact.isFetching && error && (
        <div className="contact-error" role="alert">
          <p>
            {error.status === 404
              ? 'Los datos de contacto ya no están disponibles.'
              : error.status === 429
                ? 'Has realizado demasiadas consultas. Inténtalo de nuevo más tarde.'
                : error.status === 401
                  ? 'Tu sesión ha expirado. Inicia sesión nuevamente para consultar el contacto.'
                  : 'No se pudieron cargar las opciones de contacto.'}
          </p>
          {error.status === 401 ? (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/login?returnTo=${encodeURIComponent(`/publications/${publicationId}`)}`,
                )
              }
            >
              Iniciar sesión nuevamente
            </button>
          ) : error.status !== 404 && error.status !== 429 ? (
            <button type="button" onClick={() => void contact.refetch()}>
              Reintentar
            </button>
          ) : null}
        </div>
      )}
      {revealed && !contact.isFetching && !error && methods.length > 0 && (
        <div className="contact-options">
          {methods.map((method) => {
            const href =
              method.type === 'WHATSAPP'
                ? buildWhatsAppContactUrl(method.value, animalName)
                : method.type === 'PHONE'
                  ? buildTelephoneContactUrl(method.value)
                  : buildEmailContactUrl(method.value, animalName)
            if (!href) return null
            const label =
              method.type === 'WHATSAPP'
                ? 'Contactar por WhatsApp'
                : method.type === 'PHONE'
                  ? 'Llamar por teléfono'
                  : 'Enviar email'
            return (
              <div className="contact-option" key={method.type}>
                <strong>
                  {method.type === 'PHONE'
                    ? 'Teléfono'
                    : method.type === 'EMAIL'
                      ? 'Email'
                      : 'WhatsApp'}
                </strong>
                <span>{method.value}</span>
                <a
                  className="button"
                  href={href}
                  {...(method.type === 'WHATSAPP'
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {label}
                </a>
              </div>
            )
          })}
        </div>
      )}
      {revealed && !contact.isFetching && !error && (
        <button type="button" className="secondary" onClick={hide}>
          Ocultar datos de contacto
        </button>
      )}
    </section>
  )
}
