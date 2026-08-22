import type { RequestHandler } from 'express'

export const privateNoStore: RequestHandler = (_request, response, next) => {
  response.set({
    'Cache-Control': 'private, no-store',
    Pragma: 'no-cache',
  })
  next()
}
