import '@testing-library/jest-dom/vitest'
import { zodResolver } from '@hookform/resolvers/zod'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContactSettingsFields } from './ContactSettingsFields'
import {
  contactSettingsFormSchema,
  emptyContactSettings,
  type ContactSettingsFieldsValue,
} from './contact-settings'

afterEach(cleanup)

function Harness({
  defaults = emptyContactSettings,
  status = 'ACTIVE' as const,
  original = new Set<'WHATSAPP' | 'PHONE' | 'EMAIL'>(),
}: {
  defaults?: ContactSettingsFieldsValue
  status?: 'ACTIVE' | 'RESOLVED' | 'ADOPTED' | 'ARCHIVED'
  original?: ReadonlySet<'WHATSAPP' | 'PHONE' | 'EMAIL'>
}) {
  const form = useForm<ContactSettingsFieldsValue>({
    resolver: zodResolver(contactSettingsFormSchema),
    defaultValues: defaults,
  })
  return (
    <form onSubmit={void form.handleSubmit(vi.fn())}>
      <ContactSettingsFields
        form={form}
        status={status}
        originalMethods={original}
      />
      <button>Guardar</button>
    </form>
  )
}

describe('ContactSettingsFields', () => {
  it('does not enable anything or derive the account email by default', () => {
    render(<Harness />)
    expect(screen.getByRole('checkbox', { name: 'WhatsApp' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Teléfono' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Email' })).not.toBeChecked()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText(/solo se compartirán con usuarios/)).toBeVisible()
  })

  it('copies phone to WhatsApp once and keeps both fields independent', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Teléfono' }))
    fireEvent.change(
      screen.getByLabelText('Teléfono', { selector: 'input[type="tel"]' }),
      { target: { value: '+34 600 111 222' } },
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'WhatsApp' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Usar el mismo número que Teléfono' }),
    )
    const whatsapp = screen.getByLabelText('WhatsApp', {
      selector: 'input[type="tel"]',
    })
    expect(whatsapp).toHaveValue('+34 600 111 222')
    fireEvent.change(
      screen.getByLabelText('Teléfono', { selector: 'input[type="tel"]' }),
      { target: { value: '+34600999888' } },
    )
    expect(whatsapp).toHaveValue('+34 600 111 222')
  })

  it('in a non-active publication only permits irreversible removal', () => {
    render(
      <Harness
        status="ARCHIVED"
        original={new Set(['PHONE'])}
        defaults={{
          ...emptyContactSettings,
          phoneEnabled: true,
          phone: '+34600111222',
        }}
      />,
    )
    expect(
      screen.getByLabelText('Teléfono', { selector: 'input[type="tel"]' }),
    ).toHaveAttribute('readonly')
    expect(screen.getByRole('checkbox', { name: 'Email' })).toBeDisabled()
    const phoneToggle = screen.getByRole('checkbox', { name: 'Teléfono' })
    fireEvent.click(phoneToggle)
    expect(phoneToggle).not.toBeChecked()
    expect(phoneToggle).toBeDisabled()
  })
})
