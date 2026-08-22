import { randomUUID } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'

import type { RequestHandler } from 'express'
import multer from 'multer'

import { env } from '../config/index.js'
import { ValidationError } from '../errors/app-error.js'
import {
  ImageRequestTooLargeError,
  ImageTooLargeError,
  ImageTooManyError,
} from '../errors/image-errors.js'
import { MAX_IMAGE_INPUT_BYTES } from '../images/image-limits.js'
import { logger } from '../logging/logger.js'

const maximumRequestBytes = 24 * 1024 * 1024
const temporaryRoot = path.resolve(
  path.dirname(env.IMAGE_STORAGE_LOCAL_ROOT),
  'tmp',
)

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_request, _file, callback) => {
      try {
        await mkdir(temporaryRoot, { recursive: true })
        callback(null, temporaryRoot)
      } catch (error: unknown) {
        callback(error as Error, temporaryRoot)
      }
    },
    filename: (_request, _file, callback) => {
      callback(null, `${randomUUID()}.upload`)
    },
  }),
  limits: {
    fileSize: MAX_IMAGE_INPUT_BYTES,
    files: 6,
    fields: 0,
    parts: 6,
  },
})

const parseImages = upload.array('images', 6)

export const parseImageUpload: RequestHandler = (request, response, next) => {
  parseImages(request, response, (error: unknown) => {
    const files = uploadedFiles(request)
    let cleanupPromise: Promise<void> | undefined
    const cleanup = () => {
      cleanupPromise ??= cleanupUploadedFiles(files)
      return cleanupPromise
    }
    request.cleanupImageUpload = cleanup
    const cleanupAfterResponse = () => {
      void cleanup().catch(() => {
        logger.error(
          { requestId: request.requestId },
          'temporary image upload cleanup failed',
        )
      })
    }
    const cleanupThenNext = (mappedError: Error) => {
      void cleanup().then(
        () => next(mappedError),
        () => {
          logger.error(
            { requestId: request.requestId },
            'temporary image upload cleanup failed',
          )
          next(mappedError)
        },
      )
    }
    response.once('finish', cleanupAfterResponse)
    response.once('close', cleanupAfterResponse)

    if (error) {
      cleanupThenNext(mapMultipartError(error))
      return
    }
    if (
      files.reduce((total, file) => total + file.size, 0) > maximumRequestBytes
    ) {
      cleanupThenNext(new ImageRequestTooLargeError())
      return
    }
    next()
  })
}

export function uploadedFiles(request: Express.Request): Express.Multer.File[] {
  return Array.isArray(request.files) ? request.files : []
}

export async function cleanupUploadedFiles(
  files: readonly Express.Multer.File[],
): Promise<void> {
  await Promise.all(
    files.map((file) =>
      unlink(file.path).catch((error: unknown) => {
        if (!(
          error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        ))
          throw error
      }),
    ),
  )
}

function mapMultipartError(error: unknown): Error {
  if (!(error instanceof multer.MulterError))
    return new ValidationError('Contenido multipart no válido', error)
  if (error.code === 'LIMIT_FILE_SIZE') return new ImageTooLargeError()
  if (error.code === 'LIMIT_FILE_COUNT') return new ImageTooManyError()
  if (error.code === 'LIMIT_UNEXPECTED_FILE' && error.field === 'images')
    return new ImageTooManyError()
  return new ValidationError('Contenido multipart no válido', error)
}
