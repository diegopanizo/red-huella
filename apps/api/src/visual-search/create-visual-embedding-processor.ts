import { env } from '../config/index.js'
import { db, pool } from '../database/client.js'
import { LocalImageStorage } from '../images/local-image-storage.js'
import { logger } from '../logging/logger.js'
import { DrizzlePublicationImageEmbeddingRepository } from '../repositories/drizzle-publication-image-embedding.repository.js'
import { ProcessPublicationImageEmbeddingService } from '../services/visual-embedding.service.js'
import { VisualEmbeddingProcessor } from '../services/visual-embedding-processor.js'
import { PostgresVisualEmbeddingClaim } from './embedding-claim.js'
import { VisualEmbeddingGenerator } from './visual-embedding.js'

export function createVisualEmbeddingProcessor(): VisualEmbeddingProcessor {
  const repository = new DrizzlePublicationImageEmbeddingRepository(db)
  const processor = new ProcessPublicationImageEmbeddingService(
    repository,
    new LocalImageStorage(env.IMAGE_STORAGE_LOCAL_ROOT),
    new VisualEmbeddingGenerator(env.VISUAL_MODEL_PATH),
  )
  return new VisualEmbeddingProcessor(
    {
      repository,
      processor,
      claim: new PostgresVisualEmbeddingClaim(pool),
      logger,
    },
    {
      enabled: env.VISUAL_EMBEDDING_PROCESSOR_ENABLED,
      modelConfigured: env.VISUAL_MODEL_PATH !== undefined,
      pollIntervalMs: env.VISUAL_EMBEDDING_POLL_INTERVAL_MS,
      batchSize: env.VISUAL_EMBEDDING_BATCH_SIZE,
    },
  )
}
