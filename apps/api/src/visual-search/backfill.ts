import { db, closeDatabase, pool } from '../database/client.js'
import { env } from '../config/index.js'
import { LocalImageStorage } from '../images/local-image-storage.js'
import { DrizzlePublicationImageEmbeddingRepository } from '../repositories/drizzle-publication-image-embedding.repository.js'
import { ProcessPublicationImageEmbeddingService } from '../services/visual-embedding.service.js'
import { VisualEmbeddingGenerator } from './visual-embedding.js'
import { VisualSearchError } from './visual-search-errors.js'
import { VISUAL_MODEL_ID, VISUAL_MODEL_VERSION } from './visual-model.js'
import { PostgresVisualEmbeddingClaim } from './embedding-claim.js'

interface Options {
  batchSize: number
  dryRun: boolean
  limit?: number
  retryFailed: boolean
}

const options = parseOptions(process.argv.slice(2))
const repository = new DrizzlePublicationImageEmbeddingRepository(db)
const generator = new VisualEmbeddingGenerator(env.VISUAL_MODEL_PATH)
const storage = new LocalImageStorage(env.IMAGE_STORAGE_LOCAL_ROOT)
const processor = new ProcessPublicationImageEmbeddingService(
  repository,
  storage,
  generator,
)
const claim = new PostgresVisualEmbeddingClaim(pool)
const startedAt = performance.now()
const counters = {
  examined: 0,
  ready: 0,
  skippedReady: 0,
  skippedFailed: 0,
  failed: 0,
  stale: 0,
  preprocessingMs: 0,
  inferenceMs: 0,
}

try {
  if (!options.dryRun) await generator.initialize()
  let afterImageId: string | undefined
  while (options.limit === undefined || counters.examined < options.limit) {
    const remaining =
      options.limit === undefined
        ? options.batchSize
        : Math.min(options.batchSize, options.limit - counters.examined)
    const candidates = await repository.findImagesNeedingEmbedding({
      modelId: VISUAL_MODEL_ID,
      modelVersion: VISUAL_MODEL_VERSION,
      limit: remaining,
      includeMissing: true,
      includeFailed: options.retryFailed,
      ...(afterImageId ? { afterImageId } : {}),
    })
    if (candidates.length === 0) break
    for (const candidate of candidates) {
      counters.examined += 1
      afterImageId = candidate.publicationImageId
      if (options.dryRun) continue
      const claimed = await claim.runClaimed(candidate.publicationImageId, () =>
        processor.execute(candidate.publicationImageId, {
          retryFailed: options.retryFailed,
        }),
      )
      if (!claimed.claimed) {
        counters.skippedReady += 1
        continue
      }
      const outcome = claimed.result
      if (outcome.status === 'READY') counters.ready += 1
      if (outcome.status === 'SKIPPED_READY') counters.skippedReady += 1
      if (outcome.status === 'SKIPPED_FAILED') counters.skippedFailed += 1
      if (outcome.status === 'FAILED') counters.failed += 1
      if (outcome.status === 'STALE') counters.stale += 1
      counters.preprocessingMs += outcome.preprocessingMs ?? 0
      counters.inferenceMs += outcome.inferenceMs ?? 0
    }
  }
  printSummary(options, counters, performance.now() - startedAt)
} catch (error) {
  if (error instanceof VisualSearchError)
    console.error(`Visual backfill aborted: ${error.code}`)
  else console.error('Visual backfill aborted: INTERNAL_ERROR')
  process.exitCode = 1
} finally {
  await closeDatabase()
}

function parseOptions(arguments_: string[]): Options {
  let batchSize = 25
  let limit: number | undefined
  let dryRun = false
  let retryFailed = false
  for (const argument of arguments_) {
    if (argument === '--dry-run') dryRun = true
    else if (argument === '--retry-failed') retryFailed = true
    else if (argument.startsWith('--batch-size='))
      batchSize = positiveInteger(
        argument.slice('--batch-size='.length),
        'batch-size',
      )
    else if (argument.startsWith('--limit='))
      limit = positiveInteger(argument.slice('--limit='.length), 'limit')
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return { batchSize, dryRun, retryFailed, ...(limit ? { limit } : {}) }
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000)
    throw new Error(`${name} must be an integer between 1 and 1000`)
  return parsed
}

function printSummary(
  options: Options,
  values: typeof counters,
  elapsedMs: number,
): void {
  const completed = values.ready || 1
  console.log(`Model: ${VISUAL_MODEL_ID}`)
  console.log(`Version: ${VISUAL_MODEL_VERSION}`)
  console.log(`Batch size: ${options.batchSize}`)
  console.log(`Dry run: ${options.dryRun}`)
  console.log(`Examined: ${values.examined}`)
  console.log(`Ready: ${values.ready}`)
  console.log(`Skipped ready: ${values.skippedReady}`)
  console.log(`Skipped failed: ${values.skippedFailed}`)
  console.log(`Failed: ${values.failed}`)
  console.log(`Stale: ${values.stale}`)
  console.log(
    `Average preprocessing ms: ${(values.preprocessingMs / completed).toFixed(2)}`,
  )
  console.log(
    `Average inference ms: ${(values.inferenceMs / completed).toFixed(2)}`,
  )
  console.log(`Elapsed ms: ${elapsedMs.toFixed(2)}`)
}
