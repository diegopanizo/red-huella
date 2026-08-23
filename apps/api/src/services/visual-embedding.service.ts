import type { Readable } from 'node:stream'

import type { ImageStorage } from '../images/image-storage.js'
import type { PublicationImageEmbeddingRepository } from '../repositories/contracts/publication-image-embedding.repository.js'
import { computeImageChecksum } from '../visual-search/image-checksum.js'
import { VISUAL_MAX_INPUT_BYTES } from '../visual-search/image-preprocessing.js'
import type { VisualEmbeddingGenerator } from '../visual-search/visual-embedding.js'
import { VisualSearchError } from '../visual-search/visual-search-errors.js'
import {
  VISUAL_MODEL_ID,
  VISUAL_MODEL_VERSION,
} from '../visual-search/visual-model.js'

export type ProcessVisualEmbeddingResult = {
  imageId: string
  status: 'READY' | 'SKIPPED_READY' | 'SKIPPED_FAILED' | 'FAILED' | 'STALE'
  durationMs: number
  preprocessingMs?: number
  inferenceMs?: number
  errorCode?:
    | 'IMAGE_NOT_FOUND'
    | 'INVALID_IMAGE'
    | 'EMBEDDING_GENERATION_FAILED'
    | 'INVALID_MODEL_OUTPUT'
}

export class ProcessPublicationImageEmbeddingService {
  constructor(
    private readonly repository: PublicationImageEmbeddingRepository,
    private readonly storage: ImageStorage,
    private readonly generator: Pick<
      VisualEmbeddingGenerator,
      'generateImageEmbeddingWithMetrics'
    >,
  ) {}

  async execute(
    publicationImageId: string,
    options: { retryFailed?: boolean } = {},
  ): Promise<ProcessVisualEmbeddingResult> {
    const startedAt = performance.now()
    const identity = {
      publicationImageId,
      modelId: VISUAL_MODEL_ID,
      modelVersion: VISUAL_MODEL_VERSION,
    }
    const existing = await this.repository.findByImageAndModel(identity)
    if (existing?.status === 'FAILED' && !options.retryFailed)
      return result(publicationImageId, 'SKIPPED_FAILED', startedAt)

    const source = await this.repository.findImageSource(publicationImageId)
    if (!source) {
      if (existing)
        await this.repository.markFailed({
          ...identity,
          imageChecksum: existing.imageChecksum,
          errorCode: 'IMAGE_NOT_FOUND',
        })
      return result(publicationImageId, 'FAILED', startedAt, {
        errorCode: 'IMAGE_NOT_FOUND',
      })
    }

    try {
      const bytes = await readImageSource(this.storage, source.storageKey)
      const imageChecksum = await computeImageChecksum(bytes)
      const pending = await this.repository.upsertPending({
        ...identity,
        imageChecksum,
        ...(options.retryFailed ? { retryFailed: true } : {}),
      })
      if (pending.status === 'READY')
        return result(publicationImageId, 'SKIPPED_READY', startedAt)
      if (pending.status === 'FAILED')
        return result(publicationImageId, 'SKIPPED_FAILED', startedAt)

      const generated =
        await this.generator.generateImageEmbeddingWithMetrics(bytes)
      const ready = await this.repository.markReady({
        ...identity,
        imageChecksum,
        embedding: generated.embedding,
      })
      if (!ready) return result(publicationImageId, 'STALE', startedAt)
      return result(publicationImageId, 'READY', startedAt, {
        preprocessingMs: generated.preprocessingMs,
        inferenceMs: generated.inferenceMs,
      })
    } catch (error) {
      if (
        error instanceof VisualSearchError &&
        (error.code === 'MODEL_NOT_CONFIGURED' ||
          error.code === 'MODEL_LOAD_FAILED')
      )
        throw error

      const errorCode = mapItemError(error)
      const current = await this.repository.findByImageAndModel(identity)
      if (current)
        await this.repository.markFailed({
          ...identity,
          imageChecksum: current.imageChecksum,
          errorCode,
        })
      return result(publicationImageId, 'FAILED', startedAt, { errorCode })
    }
  }
}

async function readBounded(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > VISUAL_MAX_INPUT_BYTES)
      throw new VisualSearchError('INVALID_IMAGE', 'Imagen demasiado grande')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks, total)
}

function mapItemError(
  error: unknown,
):
  | 'IMAGE_NOT_FOUND'
  | 'INVALID_IMAGE'
  | 'EMBEDDING_GENERATION_FAILED'
  | 'INVALID_MODEL_OUTPUT' {
  if (error instanceof ImageSourceNotFoundError) return 'IMAGE_NOT_FOUND'
  if (error instanceof VisualSearchError) {
    if (error.code === 'INVALID_IMAGE') return 'INVALID_IMAGE'
    if (error.code === 'INVALID_MODEL_OUTPUT') return 'INVALID_MODEL_OUTPUT'
  }
  return 'EMBEDDING_GENERATION_FAILED'
}

class ImageSourceNotFoundError extends Error {}

async function readImageSource(
  storage: ImageStorage,
  storageKey: string,
): Promise<Buffer> {
  try {
    return await readBounded(await storage.read(storageKey))
  } catch (error) {
    if (error instanceof VisualSearchError) throw error
    throw new ImageSourceNotFoundError('Stored image unavailable', {
      cause: error,
    })
  }
}

function result(
  imageId: string,
  status: ProcessVisualEmbeddingResult['status'],
  startedAt: number,
  extra: Omit<
    ProcessVisualEmbeddingResult,
    'imageId' | 'status' | 'durationMs'
  > = {},
): ProcessVisualEmbeddingResult {
  return {
    imageId,
    status,
    durationMs: performance.now() - startedAt,
    ...extra,
  }
}
