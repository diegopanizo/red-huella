import { createHash } from 'node:crypto'

import sharp, { type Metadata, type OutputInfo, type Sharp } from 'sharp'

import {
  ImageAnimatedNotAllowedError,
  ImageCorruptError,
  ImageDimensionsInvalidError,
  ImageFormatNotAllowedError,
  ImagePixelLimitExceededError,
  ImageProcessingError,
  ImageTooLargeError,
} from '../errors/image-errors.js'
import type {
  ImageProcessor,
  ProcessedImage,
  ProcessedImageVariant,
} from './image-storage.js'
import {
  MAX_IMAGE_DISPLAY_AXIS,
  MAX_IMAGE_INPUT_AXIS,
  MAX_IMAGE_INPUT_BYTES,
  MAX_IMAGE_INPUT_PIXELS,
  MAX_IMAGE_THUMBNAIL_AXIS,
} from './image-limits.js'

const allowedInputFormats = new Set(['jpeg', 'png', 'webp'])
const webpOptions = {
  quality: 82,
  alphaQuality: 100,
  smartSubsample: true,
  effort: 4,
} as const

export class SharpImageProcessor implements ImageProcessor {
  async process(input: Uint8Array): Promise<ProcessedImage> {
    if (input.byteLength > MAX_IMAGE_INPUT_BYTES) {
      throw new ImageTooLargeError()
    }
    if (input.byteLength === 0) {
      throw new ImageCorruptError()
    }

    const source = Buffer.from(input.buffer, input.byteOffset, input.byteLength)
    const metadata = await readMetadata(source)
    validateMetadata(metadata)

    try {
      const pipeline = createInput(source).autoOrient().toColourspace('srgb')
      const [display, thumbnail] = await Promise.all([
        renderVariant(pipeline.clone(), MAX_IMAGE_DISPLAY_AXIS),
        renderVariant(pipeline.clone(), MAX_IMAGE_THUMBNAIL_AXIS),
      ])
      return { display, thumbnail }
    } catch (error: unknown) {
      if (isLikelyInputDecodeError(error)) {
        throw new ImageCorruptError(error)
      }
      throw new ImageProcessingError(error)
    }
  }
}

function createInput(input: Buffer): Sharp {
  return sharp(input, {
    failOn: 'warning',
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    limitInputChannels: 4,
    unlimited: false,
    sequentialRead: true,
  })
}

async function readMetadata(input: Buffer): Promise<Metadata> {
  try {
    return await createInput(input).metadata()
  } catch (error: unknown) {
    if (isPixelLimitError(error)) {
      throw new ImagePixelLimitExceededError()
    }
    throw new ImageCorruptError(error)
  }
}

function validateMetadata(metadata: Metadata): void {
  const pages = metadata.pages ?? 1
  if (pages > 1 || metadata.pageHeight !== undefined) {
    throw new ImageAnimatedNotAllowedError()
  }
  if (!metadata.format || !allowedInputFormats.has(metadata.format)) {
    throw new ImageFormatNotAllowedError()
  }

  const { width, height } = metadata
  if (!width || !height || width <= 0 || height <= 0) {
    throw new ImageDimensionsInvalidError()
  }
  if (width > MAX_IMAGE_INPUT_AXIS || height > MAX_IMAGE_INPUT_AXIS) {
    throw new ImageDimensionsInvalidError()
  }
  if (width * height > MAX_IMAGE_INPUT_PIXELS) {
    throw new ImagePixelLimitExceededError()
  }
}

async function renderVariant(
  pipeline: Sharp,
  maximumAxis: number,
): Promise<ProcessedImageVariant> {
  const { data, info } = await pipeline
    .resize({
      width: maximumAxis,
      height: maximumAxis,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp(webpOptions)
    .toBuffer({ resolveWithObject: true })

  assertWebpOutput(info)
  return {
    data,
    mimeType: 'image/webp',
    width: info.width,
    height: info.height,
    byteSize: data.byteLength,
    checksumSha256: createHash('sha256').update(data).digest('hex'),
  }
}

function assertWebpOutput(info: OutputInfo): void {
  if (
    info.format !== 'webp' ||
    !Number.isInteger(info.width) ||
    !Number.isInteger(info.height) ||
    info.width <= 0 ||
    info.height <= 0
  ) {
    throw new ImageProcessingError()
  }
}

function isPixelLimitError(error: unknown): boolean {
  return error instanceof Error && /pixel limit/i.test(error.message)
}

function isLikelyInputDecodeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(corrupt|invalid|unsupported|premature end|unexpected end|bad seek|vipsjpeg|vipspng|vipswebp)/i.test(
      error.message,
    )
  )
}
