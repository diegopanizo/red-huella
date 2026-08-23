import { readFile } from 'node:fs/promises'

import { expect, type Page } from '@playwright/test'

const password = 'E2E secure passphrase 2026'

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@example.test`
}

export async function registerUser(
  page: Page,
  email = uniqueEmail('user'),
  name = 'Persona E2E',
): Promise<{ email: string; password: string }> {
  await page.goto('/register')
  await page.getByLabel('Nombre').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel(/^Contrase/).fill(password)
  await page.getByLabel(/^Repite la contrase/).fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(
    page.getByRole('link', { name: 'Mis publicaciones' }),
  ).toBeVisible()
  return { email, password }
}

export async function createPublication(
  page: Page,
  options: {
    title?: string
    animalName?: string
    image?: boolean
    contactEmail?: string
  } = {},
): Promise<string> {
  const title = options.title ?? `Publicacion E2E ${crypto.randomUUID()}`
  const animalName = options.animalName ?? 'Luna E2E'
  await page.goto('/publications/new')
  await page.getByLabel(/^T.tulo$/).fill(title)
  await page.getByLabel('Fecha y hora').fill('2026-01-10T12:00')
  await page.getByText('Introducir coordenadas manualmente').click()
  await page.getByLabel('Latitud manual').fill('40.4168')
  await page.getByLabel('Longitud manual').fill('-3.7038')
  await page.getByRole('button', { name: 'Aplicar coordenadas' }).click()
  await page.getByLabel('Nombre').fill(animalName)
  await page.getByLabel('Especie').selectOption('DOG')

  if (options.contactEmail) {
    await page.getByRole('checkbox', { name: 'Email' }).check()
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(options.contactEmail)
  }
  if (options.image) {
    const encoded = await readFile(
      new URL('./fixtures/pet.png.base64', import.meta.url),
      'utf8',
    )
    await page.getByLabel(/Seleccionar im/).setInputFiles({
      name: 'pet.png',
      mimeType: 'image/png',
      buffer: Buffer.from(encoded.trim(), 'base64'),
    })
    await expect(
      page.getByRole('img', { name: 'Vista previa 1' }),
    ).toBeVisible()
  }

  await page.getByRole('button', { name: /Guardar publicaci/ }).click()
  await expect(page).toHaveURL(/\/publications\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  return page.url().split('/').at(-1) ?? ''
}

export async function blockExternalTiles(page: Page): Promise<void> {
  await page.route(/https:\/\/[^/]*tile\.openstreetmap\.org\//, (route) =>
    route.abort(),
  )
}
