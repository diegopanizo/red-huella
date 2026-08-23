import type { Logger } from 'pino'

import type { PublicationImageEmbeddingRepository } from '../repositories/contracts/publication-image-embedding.repository.js'
import type { VisualEmbeddingClaim } from '../visual-search/embedding-claim.js'
import { VisualSearchError } from '../visual-search/visual-search-errors.js'
import {
  VISUAL_MODEL_ID,
  VISUAL_MODEL_VERSION,
} from '../visual-search/visual-model.js'
import type {
  ProcessPublicationImageEmbeddingService,
  ProcessVisualEmbeddingResult,
} from './visual-embedding.service.js'

export interface VisualEmbeddingBatchResult {
  examined: number
  ready: number
  skipped: number
  failed: number
  stale: number
  durationMs: number
  firstItemDurationMs?: number
  warmAverageDurationMs?: number
  unavailableCode?: 'MODEL_NOT_CONFIGURED' | 'MODEL_LOAD_FAILED'
}

type Timer = ReturnType<typeof setTimeout>

export class VisualEmbeddingProcessor {
  private timer: Timer | undefined
  private running: Promise<VisualEmbeddingBatchResult> | undefined
  private stopped = true
  private unavailableCode:
    VisualEmbeddingBatchResult['unavailableCode'] | undefined

  constructor(
    private readonly dependencies: {
      repository: Pick<
        PublicationImageEmbeddingRepository,
        'findImagesNeedingEmbedding'
      >
      processor: Pick<ProcessPublicationImageEmbeddingService, 'execute'>
      claim: VisualEmbeddingClaim
      logger: Pick<Logger, 'info' | 'error'>
    },
    private readonly options: {
      enabled: boolean
      modelConfigured: boolean
      pollIntervalMs: number
      batchSize: number
    },
  ) {}

  start(): boolean {
    if (!this.options.enabled || !this.options.modelConfigured || !this.stopped)
      return false
    this.stopped = false
    this.schedule()
    return true
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    await this.running
  }

  runOnce(): Promise<VisualEmbeddingBatchResult> {
    if (this.running) return this.running
    if (this.unavailableCode)
      return Promise.resolve(emptyBatch(this.unavailableCode))
    this.running = this.executeBatch().finally(() => {
      this.running = undefined
    })
    return this.running
  }

  private async executeBatch(): Promise<VisualEmbeddingBatchResult> {
    const startedAt = performance.now()
    const batch: VisualEmbeddingBatchResult = {
      examined: 0,
      ready: 0,
      skipped: 0,
      failed: 0,
      stale: 0,
      durationMs: 0,
    }
    const itemDurations: number[] = []
    const candidates =
      await this.dependencies.repository.findImagesNeedingEmbedding({
        modelId: VISUAL_MODEL_ID,
        modelVersion: VISUAL_MODEL_VERSION,
        limit: this.options.batchSize,
        includeMissing: false,
        includeFailed: false,
      })
    for (const candidate of candidates) {
      batch.examined += 1
      try {
        const claimed = await this.dependencies.claim.runClaimed(
          candidate.publicationImageId,
          () =>
            this.dependencies.processor.execute(candidate.publicationImageId),
        )
        if (!claimed.claimed) {
          batch.skipped += 1
          continue
        }
        itemDurations.push(claimed.result.durationMs)
        countResult(batch, claimed.result)
      } catch (error) {
        if (
          error instanceof VisualSearchError &&
          (error.code === 'MODEL_NOT_CONFIGURED' ||
            error.code === 'MODEL_LOAD_FAILED')
        ) {
          this.unavailableCode = error.code
          batch.unavailableCode = error.code
          this.dependencies.logger.error(
            { code: error.code },
            'visual embedding processor unavailable',
          )
          break
        }
        batch.failed += 1
      }
    }
    batch.durationMs = performance.now() - startedAt
    if (itemDurations[0] !== undefined)
      batch.firstItemDurationMs = itemDurations[0]
    if (itemDurations.length > 1)
      batch.warmAverageDurationMs =
        itemDurations.slice(1).reduce((sum, value) => sum + value, 0) /
        (itemDurations.length - 1)
    if (batch.examined > 0)
      this.dependencies.logger.info(
        {
          examined: batch.examined,
          ready: batch.ready,
          skipped: batch.skipped,
          failed: batch.failed,
          stale: batch.stale,
          durationMs: batch.durationMs,
        },
        'visual embedding batch completed',
      )
    return batch
  }

  private schedule(): void {
    if (this.stopped || this.unavailableCode) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.runOnce().finally(() => this.schedule())
    }, this.options.pollIntervalMs)
    this.timer.unref()
  }
}

function countResult(
  batch: VisualEmbeddingBatchResult,
  item: ProcessVisualEmbeddingResult,
): void {
  if (item.status === 'READY') batch.ready += 1
  else if (item.status === 'FAILED') batch.failed += 1
  else if (item.status === 'STALE') batch.stale += 1
  else batch.skipped += 1
}

function emptyBatch(
  unavailableCode?: VisualEmbeddingBatchResult['unavailableCode'],
): VisualEmbeddingBatchResult {
  return {
    examined: 0,
    ready: 0,
    skipped: 0,
    failed: 0,
    stale: 0,
    durationMs: 0,
    ...(unavailableCode ? { unavailableCode } : {}),
  }
}
