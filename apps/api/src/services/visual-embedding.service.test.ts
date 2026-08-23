import { Readable } from 'node:stream'

import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import type { PublicationImageEmbedding } from '../database/schema/publication-image-embeddings.js'
import type { ImageStorage } from '../images/image-storage.js'
import type { PublicationImageEmbeddingRepository } from '../repositories/contracts/publication-image-embedding.repository.js'
import { VisualSearchError } from '../visual-search/visual-search-errors.js'
import type { GeneratedVisualEmbedding } from '../visual-search/visual-embedding.js'
import { ProcessPublicationImageEmbeddingService } from './visual-embedding.service.js'

const imageId = '00000000-0000-4000-8000-000000000001'
let image: Buffer
let repository: FakeRepository
let storage: ImageStorage
let generate: Mock<(input: Buffer) => Promise<GeneratedVisualEmbedding>>

beforeEach(async () => {
  image = await fixture(30)
  repository = new FakeRepository()
  storage = {
    write: vi.fn(),
    read: vi.fn(async () => Readable.from(image)),
    delete: vi.fn(),
  }
  generate = vi.fn(async () => ({
    embedding: unitVector(),
    preprocessingMs: 2,
    inferenceMs: 3,
  }))
})

describe('ProcessPublicationImageEmbeddingService', () => {
  it('stores READY without returning the vector and skips unchanged READY', async () => {
    const service = createService()
    const ready = await service.execute(imageId)
    expect(ready).toMatchObject({
      imageId,
      status: 'READY',
      preprocessingMs: 2,
      inferenceMs: 3,
    })
    expect(ready).not.toHaveProperty('embedding')
    expect(repository.record?.status).toBe('READY')

    const skipped = await service.execute(imageId)
    expect(skipped.status).toBe('SKIPPED_READY')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(repository.record?.attemptCount).toBe(0)
  })

  it('invalidates READY and regenerates when canonical content changes', async () => {
    const service = createService()
    await service.execute(imageId)
    const firstChecksum = repository.record?.imageChecksum
    image = await fixture(180)
    expect((await service.execute(imageId)).status).toBe('READY')
    expect(repository.record?.imageChecksum).not.toBe(firstChecksum)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('skips FAILED unless retry is explicit', async () => {
    repository.record = record({
      status: 'FAILED',
      lastErrorCode: 'INVALID_IMAGE',
    })
    const service = createService()
    expect((await service.execute(imageId)).status).toBe('SKIPPED_FAILED')
    expect(generate).not.toHaveBeenCalled()
    expect((await service.execute(imageId, { retryFailed: true })).status).toBe(
      'READY',
    )
    expect(generate).toHaveBeenCalledOnce()
  })

  it('propagates global model errors without marking an image FAILED', async () => {
    generate.mockRejectedValueOnce(
      new VisualSearchError('MODEL_LOAD_FAILED', 'global model failure'),
    )
    const service = createService()
    await expect(service.execute(imageId)).rejects.toMatchObject({
      code: 'MODEL_LOAD_FAILED',
    })
    expect(repository.record?.status).toBe('PENDING')
    expect(repository.record?.attemptCount).toBe(0)
  })
})

function createService() {
  return new ProcessPublicationImageEmbeddingService(repository, storage, {
    generateImageEmbeddingWithMetrics: generate,
  })
}

class FakeRepository implements PublicationImageEmbeddingRepository {
  record: PublicationImageEmbedding | undefined

  async findImageSource(publicationImageId: string) {
    return publicationImageId === imageId
      ? { publicationImageId, storageKey: 'tests/display.webp' }
      : undefined
  }

  async findImagesNeedingEmbedding() {
    return []
  }

  async findByImageAndModel() {
    return this.record
  }

  async upsertPending(
    input: Parameters<PublicationImageEmbeddingRepository['upsertPending']>[0],
  ) {
    if (
      this.record?.status === 'READY' &&
      this.record.imageChecksum === input.imageChecksum
    )
      return this.record
    if (
      this.record?.status === 'FAILED' &&
      this.record.imageChecksum === input.imageChecksum &&
      !input.retryFailed
    )
      return this.record
    this.record = record({
      imageChecksum: input.imageChecksum,
      attemptCount:
        this.record?.imageChecksum === input.imageChecksum
          ? this.record.attemptCount
          : 0,
    })
    return this.record
  }

  async markReady(
    input: Parameters<PublicationImageEmbeddingRepository['markReady']>[0],
  ) {
    if (this.record?.imageChecksum !== input.imageChecksum) return undefined
    this.record = record({
      ...this.record,
      status: 'READY',
      embedding: Array.from(input.embedding),
      generatedAt: new Date(),
      lastErrorCode: null,
    })
    return this.record
  }

  async markFailed(
    input: Parameters<PublicationImageEmbeddingRepository['markFailed']>[0],
  ) {
    if (this.record?.imageChecksum !== input.imageChecksum) return undefined
    this.record = record({
      ...this.record,
      status: 'FAILED',
      embedding: null,
      generatedAt: null,
      lastErrorCode: input.errorCode,
      attemptCount: this.record.attemptCount + 1,
    })
    return this.record
  }

  async deleteForImageAndModel() {
    this.record = undefined
  }
}

function record(
  overrides: Partial<PublicationImageEmbedding> = {},
): PublicationImageEmbedding {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: '00000000-0000-4000-8000-000000000002',
    publicationImageId: imageId,
    modelId: 'Xenova/clip-vit-base-patch32',
    modelVersion: '6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d',
    embedding: null,
    imageChecksum: 'a'.repeat(64),
    status: 'PENDING',
    lastErrorCode: null,
    attemptCount: 0,
    generatedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function unitVector(): Float32Array {
  const value = new Float32Array(512)
  value[0] = 1
  return value
}

function fixture(red: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 80,
      height: 60,
      channels: 3,
      background: { r: red, g: 90, b: 180 },
    },
  })
    .webp()
    .toBuffer()
}
