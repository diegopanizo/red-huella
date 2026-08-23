import { expect, test } from '@playwright/test'

import {
  blockExternalTiles,
  createPublication,
  registerUser,
} from './helpers.js'

test('Cerca de mi integra listado y mapa en viewport movil', async ({
  context,
  page,
}) => {
  await blockExternalTiles(page)
  await context.grantPermissions(['geolocation'], {
    origin: 'http://127.0.0.1:5174',
  })
  await context.setGeolocation({ latitude: 40.4168, longitude: -3.7038 })
  await registerUser(page)
  const title = `Mapa movil E2E ${crypto.randomUUID()}`
  await createPublication(page, { title })
  await page.goto('/')

  await page.getByRole('button', { name: /Cerca de m/ }).click()
  await expect(page.getByText(/Cerca de m.*25 km/).first()).toBeVisible()
  await expect(
    page.getByText(/Mapa centrado en tu zona de b.*squeda de 25 km/),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lista' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    page.getByRole('button', { name: new RegExp(title) }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Mapa', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Mapa global de publicaciones' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mapa', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(layout, 'the mobile page must not overflow horizontally').toEqual({
    viewport: 390,
    document: 390,
    body: 390,
  })
})
