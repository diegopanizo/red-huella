import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VISUAL_INPUT_SHAPE } from './image-preprocessing.js'
import {
  resetVisualModelSessionForTests,
  VISUAL_EMBEDDING_DIMENSION,
  VisualEmbeddingGenerator,
  type VisualModelSession,
} from './visual-embedding.js'
import { VisualSearchError } from './visual-search-errors.js'

const preprocessed = {
  data: new Float32Array(3 * 224 * 224),
  dimensions: VISUAL_INPUT_SHAPE,
}

beforeEach(() => resetVisualModelSessionForTests())

describe('VisualEmbeddingGenerator', () => {
  it('valida salida, devuelve 512 valores y normaliza L2', async () => {
    const values = new Float32Array(VISUAL_EMBEDDING_DIMENSION).fill(2)
    const session: VisualModelSession = {
      run: vi.fn(async () => ({
        image_embeds: { data: values, dims: [1, VISUAL_EMBEDDING_DIMENSION] },
      })),
    }
    const generator = new VisualEmbeddingGenerator(
      'model.onnx',
      async () => session,
      async () => preprocessed,
    )
    const embedding = await generator.generateImageEmbedding(Buffer.from([1]))
    expect(embedding).toHaveLength(VISUAL_EMBEDDING_DIMENSION)
    const norm = Math.sqrt(
      [...embedding].reduce((sum, value) => sum + value * value, 0),
    )
    expect(norm).toBeCloseTo(1, 5)
  })

  it('rechaza ruta ausente y output incompatible con errores estables', async () => {
    const missing = new VisualEmbeddingGenerator(
      undefined,
      vi.fn(),
      async () => preprocessed,
    )
    await expect(
      missing.generateImageEmbedding(Buffer.from([1])),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_CONFIGURED' })

    const invalid = new VisualEmbeddingGenerator(
      'model.onnx',
      async () => ({
        run: async () => ({
          image_embeds: { data: new Float32Array(3), dims: [1, 3] },
        }),
      }),
      async () => preprocessed,
    )
    await expect(
      invalid.generateImageEmbedding(Buffer.from([1])),
    ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' })
  })

  it('encapsula carga e inferencia y comparte una sola sesión concurrente', async () => {
    const load = vi.fn(async () => {
      await Promise.resolve()
      return {
        run: async () => ({
          image_embeds: {
            data: new Float32Array(VISUAL_EMBEDDING_DIMENSION).fill(1),
            dims: [1, VISUAL_EMBEDDING_DIMENSION],
          },
        }),
      }
    })
    const generator = new VisualEmbeddingGenerator(
      'model.onnx',
      load,
      async () => preprocessed,
    )
    await Promise.all([generator.initialize(), generator.initialize()])
    expect(load).toHaveBeenCalledOnce()

    resetVisualModelSessionForTests()
    const loadFailure = new VisualEmbeddingGenerator(
      'bad.onnx',
      async () => {
        throw new Error('internal runtime detail')
      },
      async () => preprocessed,
    )
    await expect(loadFailure.initialize()).rejects.toMatchObject({
      code: 'MODEL_LOAD_FAILED',
    })

    resetVisualModelSessionForTests()
    const runFailure = new VisualEmbeddingGenerator(
      'model.onnx',
      async () => ({
        run: async () => {
          throw new Error('internal runtime detail')
        },
      }),
      async () => preprocessed,
    )
    await expect(
      runFailure.generateImageEmbedding(Buffer.from([1])),
    ).rejects.toMatchObject({ code: 'EMBEDDING_GENERATION_FAILED' })
  })

  it('usa errores de dominio sin exponer internals', () => {
    const error = new VisualSearchError('INVALID_IMAGE', 'Imagen inválida')
    expect(error.code).toBe('INVALID_IMAGE')
    expect(error.message).not.toContain('Sharp')
  })
})
