import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { ContactMethodType, PublicationStatus } from '../../types'
import type { ContactSettingsFieldsValue } from './contact-settings'

type Props = {
  form: UseFormReturn<ContactSettingsFieldsValue>
  status?: PublicationStatus
  originalMethods?: ReadonlySet<ContactMethodType>
}

const definitions = [
  {
    type: 'WHATSAPP',
    enabled: 'whatsappEnabled',
    value: 'whatsapp',
    label: 'WhatsApp',
    inputMode: 'tel',
  },
  {
    type: 'PHONE',
    enabled: 'phoneEnabled',
    value: 'phone',
    label: 'Teléfono',
    inputMode: 'tel',
  },
  {
    type: 'EMAIL',
    enabled: 'emailEnabled',
    value: 'email',
    label: 'Email',
    inputMode: 'email',
  },
] as const

export function ContactSettingsFields({
  form,
  status = 'ACTIVE',
  originalMethods,
}: Props) {
  const removalOnly = status !== 'ACTIVE'
  const [removed, setRemoved] = useState<ReadonlySet<ContactMethodType>>(
    new Set(),
  )
  const phone = form.watch('phone')

  return (
    <fieldset className="contact-settings">
      <legend>Contacto de esta publicación</legend>
      <p>
        Estos datos solo se compartirán con usuarios que hayan iniciado sesión.
      </p>
      <p>El email de tu cuenta no se utilizará automáticamente.</p>
      <p>
        La configuración pertenece solo a esta publicación. Al desactivar un
        método, se elimina.
      </p>
      {removalOnly && (
        <p className="privacy-transition">
          Esta publicación ya no está activa. Puedes eliminar métodos
          existentes, pero no añadirlos ni modificarlos.
        </p>
      )}
      {definitions.map((definition) => {
        const originallyEnabled = originalMethods?.has(definition.type) ?? false
        const cannotEnable =
          removalOnly && (!originallyEnabled || removed.has(definition.type))
        const enabled = form.watch(definition.enabled)
        const error = form.formState.errors[definition.value]?.message
        return (
          <div className="contact-method" key={definition.type}>
            <label className="contact-toggle">
              <input
                type="checkbox"
                {...form.register(definition.enabled)}
                disabled={cannotEnable}
                onChange={(event) => {
                  form.setValue(definition.enabled, event.target.checked, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                  if (removalOnly && !event.target.checked)
                    setRemoved((current) =>
                      new Set(current).add(definition.type),
                    )
                }}
              />
              {definition.label}
            </label>
            {enabled && (
              <div>
                <label htmlFor={`contact-${definition.value}`}>
                  {definition.label}
                </label>
                <input
                  id={`contact-${definition.value}`}
                  type={definition.inputMode === 'email' ? 'email' : 'tel'}
                  inputMode={definition.inputMode}
                  autoComplete={
                    definition.inputMode === 'email' ? 'email' : 'tel'
                  }
                  maxLength={definition.inputMode === 'email' ? 254 : 40}
                  readOnly={removalOnly}
                  aria-invalid={Boolean(error)}
                  aria-describedby={
                    error ? `contact-${definition.value}-error` : undefined
                  }
                  {...form.register(definition.value)}
                />
                {error && (
                  <p
                    id={`contact-${definition.value}-error`}
                    className="field-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                {definition.type === 'WHATSAPP' && !removalOnly && (
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() =>
                      form.setValue('whatsapp', phone, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    Usar el mismo número que Teléfono
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
