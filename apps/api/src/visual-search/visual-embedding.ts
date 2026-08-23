import * as ort from 'onnxruntime-node'

import {
  preprocessImage,
  type PreprocessedImage,
} from './image-preprocessing.js'
import { normalizeL2 } from './vector-math.js'
import { VisualSearchError } from './visual-search-errors.js'
import { VISUAL_EMBEDDING_DIMENSION } from './visual-model.js'

export {
  VISUAL_EMBEDDING_DIMENSION,
  VISUAL_MODEL_ID,
  VISUAL_MODEL_VERSION,
} from './visual-model.js'
const INPUT_NAME = 'pixel_values'
const OUTPUT_NAME = 'image_embeds'

export interface VisualModelSession {
  run(
    feeds: Readonly<Record<string, ort.Tensor>>,
  ): Promise<Readonly<Record<string, unknown>>>
}

export type VisualSessionLoader = (
  modelPath: string,
) => Promise<VisualModelSession>

export interface GeneratedVisualEmbedding {
  embedding: Float32Array
  inferenceMs: number
  preprocessingMs: number
}

let sharedSessionPromise: Promise<VisualModelSession> | undefined

async function defaultSessionLoader(
  modelPath: string,
): Promise<VisualModelSession> {
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  })
  return { run: async (feeds) => session.run(feeds) }
}

function isExpectedOutput(
  output: unknown,
): output is { data: Float32Array; dims: readonly number[] } {
  if (typeof output !== 'object' || output === null) return false
  const candidate = output as { data?: unknown; dims?: unknown }
  return (
    candidate.data instanceof Float32Array &&
    Array.isArray(candidate.dims) &&
    candidate.dims.every((dimension) => typeof dimension === 'number')
  )
}

export class VisualEmbeddingGenerator {
  constructor(
    private readonly modelPath: string | undefined,
    private readonly loadSession: VisualSessionLoader = defaultSessionLoader,
    private readonly preprocess: (
      input: Buffer,
    ) => Promise<PreprocessedImage> = preprocessImage,
  ) {}

  async initialize(): Promise<void> {
    await this.getSession()
  }

  async generateImageEmbedding(input: Buffer): Promise<Float32Array> {
    return (await this.generateImageEmbeddingWithMetrics(input)).embedding
  }

  async generateImageEmbeddingWithMetrics(
    input: Buffer,
  ): Promise<GeneratedVisualEmbedding> {
    const preprocessingStartedAt = performance.now()
    const preprocessed = await this.preprocess(input)
    const preprocessingMs = performance.now() - preprocessingStartedAt
    try {
      const session = await this.getSession()
      const inferenceStartedAt = performance.now()
      const outputs = await session.run({
        [INPUT_NAME]: new ort.Tensor('float32', preprocessed.data, [
          ...preprocessed.dimensions,
        ]),
      })
      const output = outputs[OUTPUT_NAME]
      if (
        !isExpectedOutput(output) ||
        output.dims.length !== 2 ||
        output.dims[0] !== 1 ||
        output.dims[1] !== VISUAL_EMBEDDING_DIMENSION ||
        output.data.length !== VISUAL_EMBEDDING_DIMENSION
      )
        throw new VisualSearchError(
          'INVALID_MODEL_OUTPUT',
          'El modelo devolvió una salida incompatible',
        )
      return {
        embedding: normalizeL2(Float32Array.from(output.data)),
        preprocessingMs,
        inferenceMs: performance.now() - inferenceStartedAt,
      }
    } catch (error) {
      if (error instanceof VisualSearchError) throw error
      throw new VisualSearchError(
        'EMBEDDING_GENERATION_FAILED',
        'No se pudo generar el embedding',
        { cause: error },
      )
    }
  }

  private async getSession(): Promise<VisualModelSession> {
    if (!this.modelPath)
      throw new VisualSearchError(
        'MODEL_NOT_CONFIGURED',
        'Configura VISUAL_MODEL_PATH',
      )
    sharedSessionPromise ??= this.loadSession(this.modelPath).catch((error) => {
      sharedSessionPromise = undefined
      throw new VisualSearchError(
        'MODEL_LOAD_FAILED',
        'No se pudo cargar el modelo visual',
        { cause: error },
      )
    })
    return sharedSessionPromise
  }
}

export function resetVisualModelSessionForTests(): void {
  sharedSessionPromise = undefined
}
