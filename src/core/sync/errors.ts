export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: 'manifest' | 'provider' | 'vault' | 'internal',
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'SyncError'
  }
}
