const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/g
const MAX_BASENAME_LENGTH = 200

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(INVALID_FILENAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BASENAME_LENGTH)
  return cleaned
}

export function chapterFilename(order: number, title: string): string {
  const padded = String(order).padStart(2, '0')
  const safe = sanitizeFilename(title)
  return `${padded} - ${safe}.md`
}

/**
 * Reserves a collision-free filename for `name` within the given category.
 * Identical sanitized bases get suffixed `(2)`, `(3)`, etc. Empty sanitized
 * names fall back to `_unnamed_N`.
 *
 * The allocator is stateful (mutates `used`), so entities allocated earlier
 * win the unsuffixed slot — callers should feed entities in a stable order.
 */
export class FilenameAllocator {
  private readonly used = new Set<string>()
  private unnamedCounter = 0
  public readonly warnings: string[] = []

  /** Returns the basename WITHOUT the `.md` extension. */
  allocate(rawName: string, context: string): string {
    const sanitized = sanitizeFilename(rawName)
    if (sanitized.length === 0) {
      this.unnamedCounter += 1
      const fallback = `_unnamed_${this.unnamedCounter}`
      this.used.add(fallback.toLowerCase())
      this.warnings.push(
        `Empty ${context} name after sanitization; using fallback '${fallback}'`
      )
      return fallback
    }
    const key = sanitized.toLowerCase()
    if (!this.used.has(key)) {
      this.used.add(key)
      return sanitized
    }
    for (let n = 2; n < 10_000; n++) {
      const candidate = `${sanitized} (${n})`
      const candidateKey = candidate.toLowerCase()
      if (!this.used.has(candidateKey)) {
        this.used.add(candidateKey)
        this.warnings.push(
          `Filename collision for ${context} '${rawName}'; renamed to '${candidate}'`
        )
        return candidate
      }
    }
    throw new Error(
      `Unable to allocate a unique filename for ${context} '${rawName}' after 10000 attempts`
    )
  }
}
