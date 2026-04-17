import { readFile } from 'node:fs/promises'

import type { CharacterTier } from '../../shared/types'

export interface UserOverrides {
  tier?: CharacterTier
  role?: string
}

const VALID_TIERS: CharacterTier[] = ['main', 'secondary', 'minor', 'mentioned']

/**
 * Read `user-*` frontmatter overrides from an existing character file.
 * Returns empty object if the file doesn't exist, has no frontmatter, or has
 * no `user-*` keys.
 *
 * Known limitation: the caller must know where to look. If the user manually
 * moves a character file to a different tier folder without editing frontmatter,
 * the override lookup will miss it. The intended workflow is:
 *   1. User edits `user-tier` in the file's current location.
 *   2. Next sync picks up the override and moves the file.
 */
export async function readUserOverrides(path: string): Promise<UserOverrides> {
  let content: string
  try {
    content = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw err
  }
  return parseUserOverrides(content)
}

export function parseUserOverrides(fileContent: string): UserOverrides {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const frontmatterBlock = match[1]!

  const overrides: UserOverrides = {}

  const tierMatch = frontmatterBlock.match(
    /^user-tier:\s*["']?(\w+)["']?\s*$/m
  )
  if (tierMatch) {
    const value = tierMatch[1]!
    if ((VALID_TIERS as string[]).includes(value)) {
      overrides.tier = value as CharacterTier
    }
  }

  const roleMatch = frontmatterBlock.match(
    /^user-role:\s*["']?([^"'\n]+?)["']?\s*$/m
  )
  if (roleMatch) {
    const value = roleMatch[1]!.trim()
    if (value.length > 0) overrides.role = value
  }

  return overrides
}
