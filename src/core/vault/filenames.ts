import type { CharacterTier, ExtractedCharacter } from '../../shared/types'

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

export function tierToFolder(tier: CharacterTier): string {
  switch (tier) {
    case 'main':
      return 'Main'
    case 'secondary':
      return 'Secondary'
    case 'minor':
      return 'Minor'
    case 'mentioned':
      return 'Mentioned'
  }
}

export const CHARACTER_TIER_FOLDERS: ReadonlyArray<string> = [
  'Main',
  'Secondary',
  'Minor',
  'Mentioned'
]

export interface CharacterAllocationResult {
  filenames: Map<string, string>
  warnings: string[]
}

/**
 * Allocate filenames for each character, prefixing the path with the character's
 * tier folder (`Main/`, `Secondary/`, `Minor/`, `Mentioned/`). Collisions are
 * only detected *within* a tier folder — two characters named "Amber" in
 * different tiers coexist, but two in the same tier get a `(2)` suffix on the
 * second. The value stored in the returned map does NOT include the `.md`
 * extension (matches existing convention for chapter/location filenames).
 */
export function allocateCharacterFilenames(
  characters: ExtractedCharacter[]
): CharacterAllocationResult {
  const filenames = new Map<string, string>()
  const warnings: string[] = []
  const usedByTier = new Map<string, Set<string>>()
  const unnamedByTier = new Map<string, number>()

  for (const char of characters) {
    const tierFolder = tierToFolder(char.tier)
    const used = usedByTier.get(tierFolder) ?? new Set<string>()
    usedByTier.set(tierFolder, used)

    const sanitized = sanitizeFilename(char.name)
    let basename: string
    if (sanitized.length === 0) {
      const count = (unnamedByTier.get(tierFolder) ?? 0) + 1
      unnamedByTier.set(tierFolder, count)
      basename = `_unnamed_${count}`
      warnings.push(
        `Empty character name after sanitization; using fallback '${basename}' in ${tierFolder}/`
      )
    } else {
      basename = sanitized
    }

    let candidate = basename
    let counter = 2
    while (used.has(candidate.toLowerCase())) {
      candidate = `${basename} (${counter})`
      counter += 1
      if (counter > 10_000) {
        throw new Error(
          `Unable to allocate unique character filename for '${char.name}' after 10000 attempts`
        )
      }
    }
    if (candidate !== basename) {
      warnings.push(
        `Filename collision for character '${char.name}'; renamed to '${candidate}' in ${tierFolder}/`
      )
    }
    used.add(candidate.toLowerCase())
    filenames.set(char.name, `${tierFolder}/${candidate}`)
  }

  return { filenames, warnings }
}

/**
 * Extract the basename portion of a tier-prefixed filename path. Obsidian's
 * wiki-link syntax `[[Kiel]]` resolves by basename, regardless of folder
 * location, so wiki-link rendering strips the leading `Tier/` prefix.
 */
export function basenameOf(filename: string): string {
  const slash = filename.lastIndexOf('/')
  return slash >= 0 ? filename.slice(slash + 1) : filename
}
