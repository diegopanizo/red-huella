import sharp from 'sharp'

import { VisualSearchError } from './visual-search-errors.js'

export const VISUAL_INPUT_SIZE = 224
export const VISUAL_INPUT_SHAPE = [1, 3, 224, 224] as const
export const VISUAL_MAX_INPUT_BYTES = 8 * 1024 * 1024
export const VISUAL_MAX_PIXELS = 25_000_000
export const VISUAL_MAX_AXIS = 10_000

const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073] as const
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711] as const
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

export interface PreprocessedImage {
  data: Float32Array
  dimensions: typeof VISUAL_INPUT_SHAPE
}

export interface CanonicalVisualImage extends PreprocessedImage {
  canonicalPixels: Buffer
}

export async function preprocessImage(
  input: Buffer,
): Promise<PreprocessedImage> {
  const result = await preprocessCanonicalImage(input)
  return { data: result.data, dimensions: result.dimensions }
}

export async function preprocessCanonicalImage(
  input: Buffer,
): Promise<CanonicalVisualImage> {
  if (input.length === 0 || input.length > VISUAL_MAX_INPUT_BYTES)
    throw new VisualSearchError(
      'INVALID_IMAGE',
      'La imagen no cumple el límite de bytes',
    )
  try {
    const source = sharp(input, {
      failOn: 'error',
      limitInputPixels: VISUAL_MAX_PIXELS,
      sequentialRead: true,
    })
    const metadata = await source.metadata()
    if (
      !metadata.format ||
      !ALLOWED_FORMATS.has(metadata.format) ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > VISUAL_MAX_AXIS ||
      metadata.height > VISUAL_MAX_AXIS ||
      metadata.width * metadata.height > VISUAL_MAX_PIXELS ||
      (metadata.pages ?? 1) !== 1
    )
      throw new VisualSearchError('INVALID_IMAGE', 'La imagen no es válida')

    const { data, info } = await source
      .rotate()
      .toColourspace('srgb')
      .removeAlpha()
      .resize(VISUAL_INPUT_SIZE, VISUAL_INPUT_SIZE, {
        fit: 'cover',
        position: 'centre',
        kernel: sharp.kernel.cubic,
      })
      .raw()
      .toBuffer({ resolveWithObject: true })
    if (
      info.width !== VISUAL_INPUT_SIZE ||
      info.height !== VISUAL_INPUT_SIZE ||
      info.channels !== 3
    )
      throw new VisualSearchError('INVALID_IMAGE', 'Preprocesado inesperado')

    const planeSize = VISUAL_INPUT_SIZE * VISUAL_INPUT_SIZE
    const tensor = new Float32Array(3 * planeSize)
    for (let pixel = 0; pixel < planeSize; pixel += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        const rescaled = data[pixel * 3 + channel]! / 255
        tensor[channel * planeSize + pixel] =
          (rescaled - CLIP_MEAN[channel]!) / CLIP_STD[channel]!
      }
    }
    return {
      data: tensor,
      dimensions: VISUAL_INPUT_SHAPE,
      canonicalPixels: data,
    }
  } catch (error) {
    if (error instanceof VisualSearchError) throw error
    throw new VisualSearchError(
      'INVALID_IMAGE',
      'La imagen no se pudo decodificar',
      { cause: error },
    )
  }
}
