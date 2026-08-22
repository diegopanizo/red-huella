import { createReadStream } from 'node:fs'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { access, link, mkdir, open, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'

import type { ImageStorage, WriteImageObjectInput } from './image-storage.js'
import { assertValidImageStorageKey } from './image-storage-key.js'

export class LocalImageStorage implements ImageStorage {
  readonly #root: string

  constructor(root: string) {
    if (root.trim().length === 0) {
      throw new Error('El directorio raiz de imagenes no puede estar vacio')
    }
    this.#root = path.resolve(root)
  }

  async write({ key, data }: WriteImageObjectInput): Promise<void> {
    const target = this.#resolveKey(key)
    const directory = path.dirname(target)
    await mkdir(directory, { recursive: true })

    const temporary = path.join(
      directory,
      `.${path.basename(target)}.${randomSuffix()}.tmp`,
    )
    try {
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(data)
        await handle.sync()
      } finally {
        await handle.close()
      }
      await link(temporary, target)
    } finally {
      await unlink(temporary).catch(() => undefined)
    }
  }

  async read(key: string): Promise<Readable> {
    const target = this.#resolveKey(key)
    await access(target, constants.R_OK)
    return createReadStream(target)
  }

  async delete(key: string): Promise<void> {
    const target = this.#resolveKey(key)
    await unlink(target).catch((error: unknown) => {
      if (!isMissingFileError(error)) {
        throw error
      }
    })
  }

  #resolveKey(key: string): string {
    assertValidImageStorageKey(key)
    const target = path.resolve(this.#root, ...key.split('/'))
    const relative = path.relative(this.#root, target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Storage key fuera del directorio permitido')
    }
    return target
  }
}

function randomSuffix(): string {
  return `${process.pid}-${randomUUID()}`
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
