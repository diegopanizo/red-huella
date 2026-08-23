import { closeDatabase } from '../database/client.js'
import { env } from '../config/index.js'
import { createVisualEmbeddingProcessor } from './create-visual-embedding-processor.js'

if (!env.VISUAL_MODEL_PATH) {
  console.error('Visual pending processor aborted: MODEL_NOT_CONFIGURED')
  process.exitCode = 1
} else {
  const processor = createVisualEmbeddingProcessor()
  try {
    const result = await processor.runOnce()
    console.log(`Examined: ${result.examined}`)
    console.log(`Ready: ${result.ready}`)
    console.log(`Skipped: ${result.skipped}`)
    console.log(`Failed: ${result.failed}`)
    console.log(`Stale: ${result.stale}`)
    console.log(`Duration ms: ${result.durationMs.toFixed(2)}`)
    if (result.firstItemDurationMs !== undefined)
      console.log(`First item ms: ${result.firstItemDurationMs.toFixed(2)}`)
    if (result.warmAverageDurationMs !== undefined)
      console.log(
        `Warm item average ms: ${result.warmAverageDurationMs.toFixed(2)}`,
      )
    if (result.unavailableCode) process.exitCode = 1
  } finally {
    await processor.stop()
  }
}
await closeDatabase()
