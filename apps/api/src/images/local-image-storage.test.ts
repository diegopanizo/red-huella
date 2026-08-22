import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'

import { createImageStorageKeys } from './image-storage-key.js'
import { LocalImageStorage } from './local-image-storage.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

async function createStorage(): Promise<{
  root: string
  storage: LocalImageStorage
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'red-huella-images-'))
  roots.push(root)
  return { root, storage: new LocalImageStorage(root) }
}

async function consume(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
    )
  }
  return Buffer.concat(chunks)
}

describe('image storage keys', () => {
  it('genera keys opacas separadas para las dos variantes', () => {
    const publicationId = randomUUID()
    const keys = createImageStorageKeys(publicationId)
    expect(keys.display).toBe(
      `publications/${publicationId}/${keys.imageId}/display.webp`,
    )
    expect(keys.thumbnail).toBe(
      `publications/${publicationId}/${keys.imageId}/thumbnail.webp`,
    )
    expect(keys.imageId).not.toBe(publicationId)
  })
})

describe('LocalImageStorage', () => {
  it('escribe de forma privada y permite leer el mismo contenido', async () => {
    const { root, storage } = await createStorage()
    const keys = createImageStorageKeys(randomUUID())
    const content = Buffer.from('normalized-webp-fixture')
    await storage.write({ key: keys.display, data: content })

    await expect(
      readFile(path.join(root, ...keys.display.split('/'))),
    ).resolves.toEqual(content)
    await expect(storage.read(keys.display).then(consume)).resolves.toEqual(
      content,
    )
  })

  it('no sobrescribe un objeto existente', async () => {
    const { storage } = await createStorage()
    const key = createImageStorageKeys(randomUUID()).display
    await storage.write({ key, data: Buffer.from('first') })
    await expect(
      storage.write({ key, data: Buffer.from('second') }),
    ).rejects.toMatchObject({ code: 'EEXIST' })
    await expect(storage.read(key).then(consume)).resolves.toEqual(
      Buffer.from('first'),
    )
  })

  it.each([
    '../escape.webp',
    'publications/../../escape.webp',
    'C:\\escape.webp',
    '/absolute.webp',
    'publications/not-a-uuid/id/display.webp',
  ])('rechaza una key no generada o peligrosa: %s', async (key) => {
    const { storage } = await createStorage()
    await expect(
      storage.write({ key, data: Buffer.from('x') }),
    ).rejects.toThrow(/Storage key/)
  })

  it('elimina objetos de forma idempotente', async () => {
    const { storage } = await createStorage()
    const key = createImageStorageKeys(randomUUID()).thumbnail
    await storage.write({ key, data: Buffer.from('thumbnail') })
    await expect(storage.delete(key)).resolves.toBeUndefined()
    await expect(storage.delete(key)).resolves.toBeUndefined()
    await expect(storage.read(key)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
