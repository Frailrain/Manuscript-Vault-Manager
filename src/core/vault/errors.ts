export type VaultErrorCode = 'path' | 'write' | 'permission' | 'input'

export class VaultGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: VaultErrorCode,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'VaultGenerationError'
  }
}
