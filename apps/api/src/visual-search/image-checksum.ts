import { createHash } from 'node:crypto'

import { preprocessCanonicalImage } from './image-preprocessing.js'

export async function computeImageChecksum(input: Buffer): Promise<string> {
  const { canonicalPixels } = await preprocessCanonicalImage(input)
  return createHash('sha256').update(canonicalPixels).digest('hex')
}
