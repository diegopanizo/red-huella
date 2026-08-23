import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { computeImageChecksum } from './image-checksum.js'

describe('canonical visual image checksum', () => {
  it('is deterministic and ignores metadata while detecting pixel changes', async () => {
    const base = sharp({
      create: {
        width: 80,
        height: 60,
        channels: 3,
        background: { r: 30, g: 90, b: 180 },
      },
    })
    const withoutMetadata = await base.clone().jpeg().toBuffer()
    const withMetadata = await base
      .clone()
      .withMetadata({ orientation: 1, density: 144 })
      .jpeg()
      .toBuffer()
    const different = await sharp({
      create: {
        width: 80,
        height: 60,
        channels: 3,
        background: { r: 180, g: 30, b: 90 },
      },
    })
      .jpeg()
      .toBuffer()

    const first = await computeImageChecksum(withoutMetadata)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    await expect(computeImageChecksum(withoutMetadata)).resolves.toBe(first)
    await expect(computeImageChecksum(withMetadata)).resolves.toBe(first)
    await expect(computeImageChecksum(different)).resolves.not.toBe(first)
  })
})
