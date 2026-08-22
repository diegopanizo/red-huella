import { AppError } from './app-error.js'

export class ImageFormatNotAllowedError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_FORMAT_NOT_ALLOWED',
      message: 'El formato de imagen no está permitido',
    })
  }
}

export class ImageTooLargeError extends AppError {
  constructor() {
    super({
      statusCode: 413,
      code: 'IMAGE_FILE_TOO_LARGE',
      message: 'La imagen supera el tamaño máximo permitido',
    })
  }
}

export class ImageDimensionsInvalidError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_DIMENSIONS_INVALID',
      message: 'Las dimensiones de la imagen no son válidas',
    })
  }
}

export class ImagePixelLimitExceededError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_PIXEL_LIMIT_EXCEEDED',
      message: 'La imagen supera el número máximo de píxeles permitido',
    })
  }
}

export class ImageAnimatedNotAllowedError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_ANIMATED_NOT_ALLOWED',
      message: 'Las imágenes animadas o multipágina no están permitidas',
    })
  }
}

export class ImageCorruptError extends AppError {
  constructor(cause?: unknown) {
    super({
      statusCode: 400,
      code: 'IMAGE_CORRUPT',
      message: 'La imagen no se puede decodificar',
      cause,
    })
  }
}

export class ImageProcessingError extends AppError {
  constructor(cause?: unknown) {
    super({
      statusCode: 500,
      code: 'IMAGE_PROCESSING_ERROR',
      message: 'No se ha podido procesar la imagen',
      operational: false,
      cause,
    })
  }
}

export class ImageUploadEmptyError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_UPLOAD_EMPTY',
      message: 'Debe incluir al menos una imagen',
    })
  }
}

export class ImageTooManyError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_TOO_MANY',
      message: 'La publicación no admite más imágenes',
    })
  }
}

export class ImageRequestTooLargeError extends AppError {
  constructor() {
    super({
      statusCode: 413,
      code: 'IMAGE_REQUEST_TOO_LARGE',
      message: 'La petición supera el tamaño máximo permitido',
    })
  }
}

export class ImageNotFoundError extends AppError {
  constructor() {
    super({
      statusCode: 404,
      code: 'IMAGE_NOT_FOUND',
      message: 'Imagen no encontrada',
    })
  }
}

export class ImageForbiddenError extends AppError {
  constructor() {
    super({
      statusCode: 403,
      code: 'IMAGE_FORBIDDEN',
      message: 'No tienes permiso para gestionar esta imagen',
    })
  }
}

export class ImageInvalidOrderError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_INVALID_ORDER',
      message: 'El orden de imágenes no es válido',
    })
  }
}

export class ImageUploadStatusNotAllowedError extends AppError {
  constructor() {
    super({
      statusCode: 400,
      code: 'IMAGE_UPLOAD_NOT_ALLOWED_FOR_STATUS',
      message: 'El estado de la publicación no permite esta operación',
    })
  }
}

export class StorageOperationError extends AppError {
  constructor(cause?: unknown) {
    super({
      statusCode: 503,
      code: 'STORAGE_OPERATION_FAILED',
      message: 'El almacenamiento de imágenes no está disponible',
      cause,
    })
  }
}
