import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  preprocessImage,
  VISUAL_INPUT_SHAPE,
  VISUAL_MAX_INPUT_BYTES,
} from './image-preprocessing.js'
import { VisualSearchError } from './visual-search-errors.js'

describe('preprocessImage', () => {
  it('genera un tensor RGB NCHW 1x3x224x224 finito', async () => {
    const input = await sharp({
      create: { width: 320, height: 200, channels: 4, background: '#d86550' },
    })
      .png()
      .toBuffer()
    const result = await preprocessImage(input)
    expect(result.dimensions).toEqual(VISUAL_INPUT_SHAPE)
    expect(result.data).toHaveLength(3 * 224 * 224)
    expect([...result.data].every(Number.isFinite)).toBe(true)
  })

  it('aplica orientación antes del resize y center crop', async () => {
    const pixels = Buffer.concat([Buffer.alloc(20 * 40 * 3, 0)])
    for (let index = 0; index < 20 * 40; index += 1) {
      pixels[index * 3] = index % 40 < 20 ? 255 : 0
      pixels[index * 3 + 2] = index % 40 < 20 ? 0 : 255
    }
    const base = sharp(pixels, { raw: { width: 40, height: 20, channels: 3 } })
    const oriented = await base
      .clone()
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer()
    const physicallyRotated = await base.clone().rotate(90).jpeg().toBuffer()
    const left = await preprocessImage(oriented)
    const right = await preprocessImage(physicallyRotated)
    let meanAbsoluteDifference = 0
    for (let index = 0; index < left.data.length; index += 1)
      meanAbsoluteDifference += Math.abs(left.data[index]! - right.data[index]!)
    expect(meanAbsoluteDifference / left.data.length).toBeLessThan(0.03)
  })

  it.each([
    Buffer.from('not an image'),
    Buffer.alloc(VISUAL_MAX_INPUT_BYTES + 1),
  ])('rechaza imagen corrupta o demasiado grande', async (input) => {
    await expect(preprocessImage(input)).rejects.toBeInstanceOf(
      VisualSearchError,
    )
  })
})
