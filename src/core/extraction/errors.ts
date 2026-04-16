export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: 'config' | 'provider' | 'internal',
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ExtractionError'
  }
}
