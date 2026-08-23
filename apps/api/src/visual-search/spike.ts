import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

import { cosineSimilarity } from './vector-math.js'
import {
  VISUAL_EMBEDDING_DIMENSION,
  VISUAL_MODEL_ID,
  VISUAL_MODEL_VERSION,
  VisualEmbeddingGenerator,
} from './visual-embedding.js'

async function main(): Promise<void> {
  const [imageAPath, imageBPath, imageCPath] = process.argv.slice(2)
  if (!imageAPath || !imageBPath)
    throw new Error('Uso: npm run visual:spike -- imageA imageB [imageC]')

  const invocationDirectory = process.env.INIT_CWD ?? process.cwd()
  const modelPath = process.env.VISUAL_MODEL_PATH
  const generator = new VisualEmbeddingGenerator(
    modelPath ? resolve(invocationDirectory, modelPath) : undefined,
  )
  const memoryBefore = process.memoryUsage().rss
  const loadStarted = performance.now()
  await generator.initialize()
  const loadMs = performance.now() - loadStarted
  const embed = async (path: string) => {
    const input = await readFile(resolve(invocationDirectory, path))
    const started = performance.now()
    const embedding = await generator.generateImageEmbedding(input)
    return { embedding, milliseconds: performance.now() - started }
  }
  const imageA = await embed(imageAPath)
  const imageB = await embed(imageBPath)
  const imageC = imageCPath ? await embed(imageCPath) : undefined

  console.log(`Model: ${VISUAL_MODEL_ID}@${VISUAL_MODEL_VERSION}`)
  console.log(`Dimension: ${VISUAL_EMBEDDING_DIMENSION}`)
  console.log(`Model load: ${loadMs.toFixed(1)} ms`)
  console.log(`Image A embedding: OK (${imageA.milliseconds.toFixed(1)} ms)`)
  console.log(`Image B embedding: OK (${imageB.milliseconds.toFixed(1)} ms)`)
  console.log(
    `Cosine similarity A/B: ${cosineSimilarity(imageA.embedding, imageB.embedding).toFixed(4)}`,
  )
  if (imageC) {
    console.log(`Image C embedding: OK (${imageC.milliseconds.toFixed(1)} ms)`)
    console.log(
      `Cosine similarity A/C: ${cosineSimilarity(imageA.embedding, imageC.embedding).toFixed(4)}`,
    )
  }
  const memoryDeltaMb = (process.memoryUsage().rss - memoryBefore) / 1024 / 1024
  console.log(`Approximate RSS delta: ${memoryDeltaMb.toFixed(1)} MiB`)
}

await main()
