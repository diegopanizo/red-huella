import { createHash } from 'node:crypto'

import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  ImageAnimatedNotAllowedError,
  ImageCorruptError,
  ImageDimensionsInvalidError,
  ImageFormatNotAllowedError,
  ImagePixelLimitExceededError,
  ImageTooLargeError,
} from '../errors/image-errors.js'
import { MAX_IMAGE_INPUT_BYTES } from './image-limits.js'
import { SharpImageProcessor } from './sharp-image-processor.js'

const processor = new SharpImageProcessor()
let jpegFixture: Buffer
let pngFixture: Buffer
let webpFixture: Buffer

beforeAll(async () => {
  jpegFixture = await createSolidImage(1200, 800).jpeg().toBuffer()
  pngFixture = await createSolidImage(900, 600).png().toBuffer()
  webpFixture = await createSolidImage(700, 500).webp().toBuffer()
})

describe('SharpImageProcessor formats and normalization', () => {
  it.each([
    ['JPEG', () => jpegFixture],
    ['PNG', () => pngFixture],
    ['WebP', () => webpFixture],
  ])(
    'accepts a valid %s and normalizes both variants to WebP',
    async (_, fixture) => {
      const result = await processor.process(fixture())

      await expectVariantMatchesData(result.display)
      await expectVariantMatchesData(result.thumbnail)
      expect(result.display.mimeType).toBe('image/webp')
      expect(result.thumbnail.mimeType).toBe('image/webp')
    },
  )

  it('limits display and thumbnail while preserving aspect ratio', async () => {
    const input = await createSolidImage(3000, 1500).jpeg().toBuffer()
    const result = await processor.process(input)

    expect(result.display).toMatchObject({ width: 2048, height: 1024 })
    expect(result.thumbnail).toMatchObject({ width: 640, height: 320 })
  })

  it('does not enlarge small images', async () => {
    const input = await createSolidImage(320, 180).png().toBuffer()
    const result = await processor.process(input)

    expect(result.display).toMatchObject({ width: 320, height: 180 })
    expect(result.thumbnail).toMatchObject({ width: 320, height: 180 })
  })

  it('autorotates from EXIF orientation and strips metadata including GPS', async () => {
    const input = await createSolidImage(80, 40)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExifMerge({
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 25/1 0/1' },
      })
      .toBuffer()
    const inputMetadata = await sharp(input).metadata()
    expect(inputMetadata.exif).toBeDefined()
    expect(inputMetadata.orientation).toBe(6)

    const result = await processor.process(input)
    expect(result.display).toMatchObject({ width: 40, height: 80 })
    const outputMetadata = await sharp(result.display.data).metadata()
    expect(outputMetadata.orientation).toBeUndefined()
    expect(outputMetadata.exif).toBeUndefined()
    expect(outputMetadata.xmp).toBeUndefined()
    expect(outputMetadata.icc).toBeUndefined()
    expect(outputMetadata.space).toBe('srgb')
  })

  it('preserves alpha from transparent PNG and WebP inputs', async () => {
    const rgba = Buffer.alloc(32 * 24 * 4)
    for (let index = 0; index < rgba.length; index += 4) {
      rgba[index] = 10
      rgba[index + 1] = 100
      rgba[index + 2] = 200
      rgba[index + 3] = 80
    }
    const transparentPng = await sharp(rgba, {
      raw: { width: 32, height: 24, channels: 4 },
    })
      .png()
      .toBuffer()
    const transparentWebp = await sharp(rgba, {
      raw: { width: 32, height: 24, channels: 4 },
    })
      .webp()
      .toBuffer()

    for (const input of [transparentPng, transparentWebp]) {
      const result = await processor.process(input)
      const metadata = await sharp(result.display.data).metadata()
      expect(metadata.hasAlpha).toBe(true)
      const alpha = await sharp(result.display.data)
        .extractChannel('alpha')
        .raw()
        .toBuffer()
      expect(alpha[0]).toBe(80)
    }
  })

  it('calculates byte sizes and independent SHA-256 checksums', async () => {
    const result = await processor.process(jpegFixture)

    for (const variant of [result.display, result.thumbnail]) {
      expect(variant.byteSize).toBe(variant.data.byteLength)
      expect(variant.checksumSha256).toBe(
        createHash('sha256').update(variant.data).digest('hex'),
      )
    }
    expect(result.display.checksumSha256).not.toBe(
      result.thumbnail.checksumSha256,
    )
  })
})

describe('SharpImageProcessor rejection and limits', () => {
  it('rejects SVG even though Sharp can decode it', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    )
    await expect(processor.process(svg)).rejects.toBeInstanceOf(
      ImageFormatNotAllowedError,
    )
  })

  it('rejects a static GIF as a non-allowed format', async () => {
    const gif = await createSolidImage(10, 10).gif().toBuffer()
    await expect(processor.process(gif)).rejects.toBeInstanceOf(
      ImageFormatNotAllowedError,
    )
  })

  it('rejects HEIF even though Sharp can decode it', async () => {
    const heif = await createSolidImage(10, 10)
      .heif({ compression: 'av1' })
      .toBuffer()
    await expect(processor.process(heif)).rejects.toBeInstanceOf(
      ImageFormatNotAllowedError,
    )
  })

  it('rejects animated GIF and animated WebP as animation', async () => {
    const { gif, webp } = await createAnimatedFixtures()
    await expect(processor.process(gif)).rejects.toBeInstanceOf(
      ImageAnimatedNotAllowedError,
    )
    await expect(processor.process(webp)).rejects.toBeInstanceOf(
      ImageAnimatedNotAllowedError,
    )
  })

  it('rejects corrupt data and hides Sharp details in the public message', async () => {
    const promise = processor.process(Buffer.from('not an image'))
    await expect(promise).rejects.toMatchObject({
      code: 'IMAGE_CORRUPT',
      message: 'La imagen no se puede decodificar',
    })
    await expect(promise).rejects.toBeInstanceOf(ImageCorruptError)
  })

  it('rejects an input larger than 8 MiB before decoding', async () => {
    await expect(
      processor.process(Buffer.alloc(MAX_IMAGE_INPUT_BYTES + 1)),
    ).rejects.toBeInstanceOf(ImageTooLargeError)
  })

  it('rejects input over 25 megapixels', async () => {
    const input = await createSolidImage(5001, 5000).png().toBuffer()
    await expect(processor.process(input)).rejects.toBeInstanceOf(
      ImagePixelLimitExceededError,
    )
  })

  it('rejects an input axis over 10,000 pixels', async () => {
    const input = await createSolidImage(10_001, 1).png().toBuffer()
    await expect(processor.process(input)).rejects.toBeInstanceOf(
      ImageDimensionsInvalidError,
    )
  })
})

function createSolidImage(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20, g: 120, b: 210, alpha: 0.8 },
    },
  })
}

async function createAnimatedFixtures(): Promise<{
  gif: Buffer
  webp: Buffer
}> {
  const frames = await Promise.all([
    sharp({
      create: {
        width: 8,
        height: 6,
        channels: 4,
        background: 'red',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      create: {
        width: 8,
        height: 6,
        channels: 4,
        background: 'blue',
      },
    })
      .png()
      .toBuffer(),
  ])
  const source = () => sharp(frames, { join: { animated: true } })
  return {
    gif: await source()
      .gif({ delay: [100, 100], loop: 0 })
      .toBuffer(),
    webp: await source()
      .webp({ delay: [100, 100], loop: 0 })
      .toBuffer(),
  }
}

async function expectVariantMatchesData(variant: {
  data: Uint8Array
  width: number
  height: number
  byteSize: number
  checksumSha256: string
}): Promise<void> {
  const metadata = await sharp(variant.data).metadata()
  expect(metadata.format).toBe('webp')
  expect(metadata.width).toBe(variant.width)
  expect(metadata.height).toBe(variant.height)
  expect(variant.byteSize).toBe(variant.data.byteLength)
  expect(variant.checksumSha256).toMatch(/^[0-9a-f]{64}$/)
}
