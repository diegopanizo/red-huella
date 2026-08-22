import type { Readable } from 'node:stream'

export interface ImageStorageKeys {
  readonly display: string
  readonly thumbnail: string
}

export interface WriteImageObjectInput {
  readonly key: string
  readonly data: Uint8Array
}

export interface ImageStorage {
  write(input: WriteImageObjectInput): Promise<void>
  read(key: string): Promise<Readable>
  delete(key: string): Promise<void>
}

export interface ProcessedImageVariant {
  readonly data: Uint8Array
  readonly mimeType: 'image/webp'
  readonly width: number
  readonly height: number
  readonly byteSize: number
  readonly checksumSha256: string
}

export interface ProcessedImage {
  readonly display: ProcessedImageVariant
  readonly thumbnail: ProcessedImageVariant
}

export interface ImageProcessor {
  process(input: Uint8Array): Promise<ProcessedImage>
}
