import { readFile } from 'node:fs/promises'

import type { RequestHandler } from 'express'
import { z } from 'zod'

import { ValidationError } from '../errors/app-error.js'
import { UnauthenticatedError } from '../errors/auth-errors.js'
import { ImageUploadEmptyError } from '../errors/image-errors.js'
import { uploadedFiles } from '../middleware/image-upload.js'
import {
  publicationIdSchema,
  publicationImageIdSchema,
  reorderPublicationImagesSchema,
} from '../publications/schemas.js'
import type {
  DeletePublicationImageService,
  GetPublicationImageContentService,
  ReorderPublicationImagesService,
  UploadPublicationImagesService,
} from '../services/image.services.js'

const contentImageIdSchema = z.object({ imageId: z.uuid() }).strict()

function parseOrThrow<T>(
  result: { success: true; data: T } | { success: false; error: unknown },
): T {
  if (!result.success)
    throw new ValidationError('Datos de imagen no válidos', result.error)
  return result.data
}

export class PublicationImageController {
  constructor(
    private readonly uploadImages: UploadPublicationImagesService,
    private readonly deleteImage: DeletePublicationImageService,
    private readonly reorderImages: ReorderPublicationImagesService,
  ) {}

  upload: RequestHandler = async (request, response, next) => {
    const files = uploadedFiles(request)
    try {
      if (!request.auth) throw new UnauthenticatedError()
      if (files.length === 0) throw new ImageUploadEmptyError()
      const { id } = parseOrThrow(publicationIdSchema.safeParse(request.params))
      const inputs: Buffer[] = []
      for (const file of files) inputs.push(await readFile(file.path))
      response.status(201).json({
        images: await this.uploadImages.execute(
          id,
          request.auth.userId,
          inputs,
        ),
      })
    } catch (error: unknown) {
      next(error)
    } finally {
      await request.cleanupImageUpload?.().catch(() => undefined)
    }
  }

  delete: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const { id, imageId } = parseOrThrow(
        publicationImageIdSchema.safeParse(request.params),
      )
      await this.deleteImage.execute(id, imageId, request.auth.userId)
      response.status(204).end()
    } catch (error: unknown) {
      next(error)
    }
  }

  reorder: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new UnauthenticatedError()
      const { id } = parseOrThrow(publicationIdSchema.safeParse(request.params))
      const { imageIds } = parseOrThrow(
        reorderPublicationImagesSchema.safeParse(request.body),
      )
      response.json({
        images: await this.reorderImages.execute(
          id,
          request.auth.userId,
          imageIds,
        ),
      })
    } catch (error: unknown) {
      next(error)
    }
  }
}

export class PublicationImageContentController {
  constructor(private readonly getContent: GetPublicationImageContentService) {}

  display: RequestHandler = (request, response, next) =>
    this.send('display', request, response, next)

  thumbnail: RequestHandler = (request, response, next) =>
    this.send('thumbnail', request, response, next)

  private async send(
    variant: 'display' | 'thumbnail',
    request: Parameters<RequestHandler>[0],
    response: Parameters<RequestHandler>[1],
    next: Parameters<RequestHandler>[2],
  ): Promise<void> {
    try {
      const { imageId } = parseOrThrow(
        contentImageIdSchema.safeParse(request.params),
      )
      const content = await this.getContent.execute(
        imageId,
        variant,
        request.auth?.userId,
      )
      response.set({
        'Content-Type': 'image/webp',
        'Content-Length': String(content.byteSize),
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        ETag: content.etag,
        'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
      })
      if (request.get('if-none-match') === content.etag) {
        content.stream.destroy()
        response.status(304).end()
        return
      }
      content.stream.once('error', next)
      content.stream.pipe(response)
    } catch (error: unknown) {
      next(error)
    }
  }
}
