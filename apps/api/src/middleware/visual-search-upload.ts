import type { RequestHandler } from 'express'
import multer from 'multer'

import { ValidationError } from '../errors/app-error.js'
import { ImageTooLargeError } from '../errors/image-errors.js'
import { MAX_IMAGE_INPUT_BYTES } from '../images/image-limits.js'

const parse = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_INPUT_BYTES,
    files: 1,
    fields: 10,
    parts: 11,
  },
}).single('image')

export const parseVisualSearchUpload: RequestHandler = (
  request,
  response,
  next,
) => {
  parse(request, response, (error: unknown) => {
    if (!error) return next()
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE')
      return next(new ImageTooLargeError())
    return next(new ValidationError('Contenido multipart no válido', error))
  })
}
