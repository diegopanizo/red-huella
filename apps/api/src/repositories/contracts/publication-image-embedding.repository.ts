import type { PublicationImageEmbedding } from '../../database/schema/publication-image-embeddings.js'

export const visualEmbeddingErrorCodes = [
  'IMAGE_NOT_FOUND',
  'INVALID_IMAGE',
  'MODEL_LOAD_FAILED',
  'EMBEDDING_GENERATION_FAILED',
  'INVALID_MODEL_OUTPUT',
] as const

export type VisualEmbeddingErrorCode =
  (typeof visualEmbeddingErrorCodes)[number]

export interface EmbeddingIdentity {
  publicationImageId: string
  modelId: string
  modelVersion: string
}

export interface PublicationImageEmbeddingCandidate {
  publicationImageId: string
  storageKey: string
  embeddingStatus: 'PENDING' | 'READY' | 'FAILED' | null
  imageChecksum: string | null
}

export interface PublicationImageEmbeddingRepository {
  findImageSource(
    publicationImageId: string,
  ): Promise<{ publicationImageId: string; storageKey: string } | undefined>
  findImagesNeedingEmbedding(input: {
    modelId: string
    modelVersion: string
    limit: number
    includeMissing: boolean
    includeFailed: boolean
    afterImageId?: string
  }): Promise<PublicationImageEmbeddingCandidate[]>
  findByImageAndModel(
    identity: EmbeddingIdentity,
  ): Promise<PublicationImageEmbedding | undefined>
  upsertPending(
    input: EmbeddingIdentity & {
      imageChecksum: string
      retryFailed?: boolean
    },
  ): Promise<PublicationImageEmbedding>
  markReady(
    input: EmbeddingIdentity & {
      imageChecksum: string
      embedding: Float32Array | readonly number[]
    },
  ): Promise<PublicationImageEmbedding | undefined>
  markFailed(
    input: EmbeddingIdentity & {
      imageChecksum: string
      errorCode: VisualEmbeddingErrorCode
    },
  ): Promise<PublicationImageEmbedding | undefined>
  deleteForImageAndModel(identity: EmbeddingIdentity): Promise<void>
}
