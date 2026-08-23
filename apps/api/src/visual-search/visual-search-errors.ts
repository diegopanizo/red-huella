export type VisualSearchErrorCode =
  | 'MODEL_NOT_CONFIGURED'
  | 'MODEL_LOAD_FAILED'
  | 'INVALID_IMAGE'
  | 'INVALID_MODEL_OUTPUT'
  | 'EMBEDDING_GENERATION_FAILED'

export class VisualSearchError extends Error {
  constructor(
    readonly code: VisualSearchErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'VisualSearchError'
  }
}
