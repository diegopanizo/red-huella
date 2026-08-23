import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import {
  blockExternalTiles,
  createPublication,
  registerUser,
  uniqueEmail,
} from './helpers.js'

test.beforeEach(async ({ page }) => blockExternalTiles(page))

test('registro, sesion, logout y nuevo login', async ({ page }) => {
  const credentials = await registerUser(page)
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel(/^Contrase/).fill(credentials.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(
    page.getByRole('link', { name: 'Mis publicaciones' }),
  ).toBeVisible()
})

test('crea una publicacion y abre su gestion owner', async ({ page }) => {
  await registerUser(page)
  const title = `Perro perdido E2E ${crypto.randomUUID()}`
  await createPublication(page, { title })
  await page.getByRole('button', { name: 'Editar' }).click()
  await expect(
    page.getByRole('heading', { name: /Editar publicaci/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Estado de la ficha' }),
  ).toBeVisible()
})

test('sube una imagen y la muestra como principal en la galeria', async ({
  page,
}) => {
  await registerUser(page)
  await createPublication(page, { image: true, animalName: 'Nala E2E' })
  await expect(
    page.getByRole('img', { name: 'Imagen de Nala E2E' }),
  ).toBeVisible()
  await expect(page.getByText(/1 de 6 im.* guardadas/)).toBeVisible()
})

test('el contacto solo se revela bajo click a otro usuario autenticado', async ({
  browser,
  page,
}) => {
  const contactEmail = uniqueEmail('contacto')
  await registerUser(page, uniqueEmail('owner'), 'Owner E2E')
  const publicationId = await createPublication(page, { contactEmail })
  await page.getByRole('button', { name: 'Salir' }).click()

  const anonymousContext = await browser.newContext()
  const anonymousPage = await anonymousContext.newPage()
  await anonymousPage.goto(`/publications/${publicationId}`)
  await anonymousPage
    .getByRole('button', { name: 'Ver opciones de contacto' })
    .click()
  await expect(anonymousPage).toHaveURL(/\/login\?returnTo=/)
  await anonymousContext.close()

  await registerUser(page, uniqueEmail('visitor'), 'Visitante E2E')
  await page.goto(`/publications/${publicationId}`)

  await expect(page.getByText(contactEmail)).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver opciones de contacto' }).click()
  await expect(page.getByText(contactEmail)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Enviar email' })).toBeVisible()
})

test('recorre la busqueda visual con respuesta HTTP contractual mockeada', async ({
  page,
}) => {
  await registerUser(page)
  const title = `Resultado visual E2E ${crypto.randomUUID()}`
  const publicationId = await createPublication(page, {
    title,
    animalName: 'Bruma E2E',
  })
  let requestObserved = false
  let releaseResponse = (): void => undefined
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route('**/api/v1/publications/search-by-image', async (route) => {
    requestObserved = route.request().method() === 'POST'
    await responseGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            publication: {
              id: publicationId,
              type: 'LOST',
              title,
              eventDate: '2026-01-10T12:00:00.000Z',
              animal: { name: 'Bruma E2E', species: 'DOG', breed: null },
              primaryImage: null,
              publicLocation: null,
            },
            matchedImage: {
              id: '00000000-0000-4000-8000-000000000001',
              thumbnailUrl:
                '/api/v1/publication-images/00000000-0000-4000-8000-000000000001/thumbnail',
            },
            visualSimilarity: 0.88,
          },
        ],
      }),
    })
  })

  await page.goto('/search-by-image')
  const encoded = await readFile(
    new URL('./fixtures/pet.png.base64', import.meta.url),
    'utf8',
  )
  await page.getByLabel('Selecciona o arrastra una foto').setInputFiles({
    name: 'query.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encoded.trim(), 'base64'),
  })
  await expect(
    page.getByRole('img', { name: 'Vista previa de la foto seleccionada' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Buscar similares' }).click()
  await expect(
    page.getByText(/Buscando publicaciones similares/).first(),
  ).toBeVisible()
  releaseResponse()
  await expect(
    page.getByRole('heading', { name: /Resultados visualmente similares/ }),
  ).toBeVisible()
  await expect(
    page.getByText('Similitud visual', { exact: true }),
  ).toBeVisible()
  expect(requestObserved).toBe(true)
  await page.getByRole('link', { name: /Ver publicaci/ }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})
