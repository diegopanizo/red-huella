import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PublicationImageEmbeddingCandidate } from '../repositories/contracts/publication-image-embedding.repository.js'
import type { VisualEmbeddingClaim } from '../visual-search/embedding-claim.js'
import { VisualSearchError } from '../visual-search/visual-search-errors.js'
import { VisualEmbeddingProcessor } from './visual-embedding-processor.js'
import type { ProcessVisualEmbeddingResult } from './visual-embedding.service.js'

afterEach(() => vi.useRealTimers())

describe('VisualEmbeddingProcessor', () => {
  it('does nothing and emits no batch log when there are no pending images', async () => {
    const fixture = createFixture([])
    expect(await fixture.processor.runOnce()).toMatchObject({ examined: 0 })
    expect(fixture.process).not.toHaveBeenCalled()
    expect(fixture.info).not.toHaveBeenCalled()
  })

  it('processes a bounded batch sequentially and continues after item failures', async () => {
    const active = { current: 0, maximum: 0 }
    const fixture = createFixture(
      candidates(3),
      async (imageId) => {
        active.current += 1
        active.maximum = Math.max(active.maximum, active.current)
        await Promise.resolve()
        active.current -= 1
        return outcome(imageId, imageId.endsWith('2') ? 'FAILED' : 'READY')
      },
      2,
    )
    const result = await fixture.processor.runOnce()
    expect(result).toMatchObject({ examined: 2, ready: 1, failed: 1 })
    expect(fixture.process).toHaveBeenCalledTimes(2)
    expect(active.maximum).toBe(1)
  })

  it('skips an item claimed by another consumer', async () => {
    const fixture = createFixture(candidates(1), undefined, 5, false)
    expect(await fixture.processor.runOnce()).toMatchObject({
      examined: 1,
      skipped: 1,
    })
    expect(fixture.process).not.toHaveBeenCalled()
  })

  it('stops the cycle and disables future work after a global model error', async () => {
    const fixture = createFixture(candidates(2), async () => {
      throw new VisualSearchError('MODEL_LOAD_FAILED', 'synthetic')
    })
    expect(await fixture.processor.runOnce()).toMatchObject({
      examined: 1,
      unavailableCode: 'MODEL_LOAD_FAILED',
    })
    expect(await fixture.processor.runOnce()).toMatchObject({
      examined: 0,
      unavailableCode: 'MODEL_LOAD_FAILED',
    })
    expect(fixture.process).toHaveBeenCalledOnce()
    expect(fixture.error).toHaveBeenCalledOnce()
  })

  it('shares an in-flight run instead of overlapping cycles', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fixture = createFixture(candidates(1), async (imageId) => {
      await gate
      return outcome(imageId, 'READY')
    })
    const first = fixture.processor.runOnce()
    const second = fixture.processor.runOnce()
    expect(second).toBe(first)
    release?.()
    await first
    expect(fixture.process).toHaveBeenCalledOnce()
  })

  it('does not start when disabled or without a model', () => {
    expect(createFixture([], undefined, 5, true, false).processor.start()).toBe(
      false,
    )
    expect(
      createFixture([], undefined, 5, true, true, false).processor.start(),
    ).toBe(false)
  })

  it('start schedules polling and stop clears the timer without real delays', async () => {
    vi.useFakeTimers()
    const fixture = createFixture([])
    expect(fixture.processor.start()).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
    await fixture.processor.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})

function createFixture(
  rows: PublicationImageEmbeddingCandidate[],
  implementation: (
    imageId: string,
  ) => Promise<ProcessVisualEmbeddingResult> = async (imageId) =>
    outcome(imageId, 'READY'),
  batchSize = 5,
  claimed = true,
  enabled = true,
  modelConfigured = true,
) {
  const find = vi.fn(async () => rows.slice(0, batchSize))
  const process = vi.fn(implementation)
  const claim: VisualEmbeddingClaim = {
    runClaimed: async (_imageId, operation) =>
      claimed
        ? { claimed: true, result: await operation() }
        : { claimed: false },
  }
  const info = vi.fn()
  const error = vi.fn()
  return {
    processor: new VisualEmbeddingProcessor(
      {
        repository: { findImagesNeedingEmbedding: find },
        processor: { execute: process },
        claim,
        logger: { info, error },
      },
      { enabled, modelConfigured, pollIntervalMs: 30_000, batchSize },
    ),
    process,
    info,
    error,
  }
}

function candidates(count: number): PublicationImageEmbeddingCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    publicationImageId: `00000000-0000-4000-8000-00000000000${index + 1}`,
    storageKey: `tests/${index}/display.webp`,
    embeddingStatus: 'PENDING',
    imageChecksum: 'a'.repeat(64),
  }))
}

function outcome(
  imageId: string,
  status: ProcessVisualEmbeddingResult['status'],
): ProcessVisualEmbeddingResult {
  return { imageId, status, durationMs: 1 }
}
