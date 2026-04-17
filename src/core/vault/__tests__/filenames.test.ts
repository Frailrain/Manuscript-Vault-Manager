import { describe, expect, it } from 'vitest'

import type { ExtractedCharacter } from '../../../shared/types'
import {
  CHARACTER_TIER_FOLDERS,
  allocateCharacterFilenames,
  basenameOf,
  chapterFilename,
  FilenameAllocator,
  sanitizeFilename,
  tierToFolder
} from '../filenames'

function buildChar(
  name: string,
  tier: ExtractedCharacter['tier']
): ExtractedCharacter {
  return {
    name,
    aliases: [],
    description: '',
    chapterActivity: {},
    role: '',
    relationships: [],
    firstAppearanceChapter: 1,
    appearances: [1],
    tier,
    customFields: {}
  }
}

describe('sanitizeFilename', () => {
  it('strips all invalid filename characters', () => {
    const messy = 'Elara/Vorn: the *tale* of "war"?<>|\\'
    const clean = sanitizeFilename(messy)
    expect(clean).toBe('ElaraVorn the tale of war')
    expect(clean).not.toMatch(/[/\\:*?"<>|]/)
  })

  it('collapses consecutive whitespace and trims the result', () => {
    expect(sanitizeFilename('  hello    world  ')).toBe('hello world')
  })

  it('caps length at 200 characters', () => {
    const long = 'a'.repeat(500)
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200)
  })
})

describe('chapterFilename', () => {
  it('zero-pads the order and applies the separator', () => {
    expect(chapterFilename(3, 'The Silver Tower')).toBe(
      '03 - The Silver Tower.md'
    )
  })

  it('handles double-digit chapters', () => {
    expect(chapterFilename(12, 'Return')).toBe('12 - Return.md')
  })
})

describe('FilenameAllocator', () => {
  it('suffixes collisions with (2), (3), ...', () => {
    const alloc = new FilenameAllocator()
    expect(alloc.allocate('Elara', 'character')).toBe('Elara')
    expect(alloc.allocate('Elara', 'character')).toBe('Elara (2)')
    expect(alloc.allocate('Elara', 'character')).toBe('Elara (3)')
    expect(alloc.warnings.length).toBe(2)
  })

  it('is case-insensitive when detecting collisions', () => {
    const alloc = new FilenameAllocator()
    alloc.allocate('Elara', 'character')
    expect(alloc.allocate('ELARA', 'character')).toBe('ELARA (2)')
  })

  it('falls back to _unnamed_N for empty names', () => {
    const alloc = new FilenameAllocator()
    expect(alloc.allocate('', 'character')).toBe('_unnamed_1')
    expect(alloc.allocate('???', 'character')).toBe('_unnamed_2')
    expect(alloc.warnings.length).toBe(2)
  })
})

describe('tierToFolder', () => {
  it('maps each tier to its numerically-prefixed folder name', () => {
    expect(tierToFolder('main')).toBe('1 - Main')
    expect(tierToFolder('secondary')).toBe('2 - Secondary')
    expect(tierToFolder('minor')).toBe('3 - Minor')
    expect(tierToFolder('mentioned')).toBe('4 - Mentioned')
  })

  it('produces folder names that all start with a numeric prefix', () => {
    for (const tier of ['main', 'secondary', 'minor', 'mentioned'] as const) {
      expect(tierToFolder(tier)).toMatch(/^\d+ - /)
    }
  })

  it('produces folder names whose alphabetical sort matches tier priority', () => {
    const sorted = [...CHARACTER_TIER_FOLDERS].sort()
    expect(sorted).toEqual([
      '1 - Main',
      '2 - Secondary',
      '3 - Minor',
      '4 - Mentioned'
    ])
  })
})

describe('basenameOf', () => {
  it('returns the last path segment', () => {
    expect(basenameOf('Main/Kiel')).toBe('Kiel')
    expect(basenameOf("Ganston's Crossing/Defensive Line/East Gate")).toBe(
      'East Gate'
    )
  })

  it('returns the input unchanged when it has no slash', () => {
    expect(basenameOf('Elara')).toBe('Elara')
  })
})

describe('allocateCharacterFilenames', () => {
  it('prefixes each filename with the tier folder', () => {
    const result = allocateCharacterFilenames([
      buildChar('Kiel', 'main'),
      buildChar('Ada', 'secondary'),
      buildChar('Guard', 'minor'),
      buildChar("Kiel's Mother", 'mentioned')
    ])
    expect(result.filenames.get('Kiel')).toBe('1 - Main/Kiel')
    expect(result.filenames.get('Ada')).toBe('2 - Secondary/Ada')
    expect(result.filenames.get('Guard')).toBe('3 - Minor/Guard')
    expect(result.filenames.get("Kiel's Mother")).toBe(
      "4 - Mentioned/Kiel's Mother"
    )
    expect(result.warnings).toHaveLength(0)
  })

  it('does not collide two similarly-named characters in different tiers', () => {
    const result = allocateCharacterFilenames([
      buildChar('Amber', 'main'),
      buildChar('Amber?', 'minor')
    ])
    expect(result.filenames.get('Amber')).toBe('1 - Main/Amber')
    expect(result.filenames.get('Amber?')).toBe('3 - Minor/Amber')
  })

  it('suffixes (2) on the second same-tier collision', () => {
    const result = allocateCharacterFilenames([
      { ...buildChar('Amber', 'main'), role: 'knight' },
      { ...buildChar('Amber?', 'main'), role: 'apprentice' }
    ])
    expect(result.filenames.get('Amber')).toBe('1 - Main/Amber')
    expect(result.filenames.get('Amber?')).toBe('1 - Main/Amber (2)')
    expect(result.warnings.some((w) => w.includes('Amber'))).toBe(true)
  })

  it('falls back to _unnamed_N (scoped per tier) for empty names', () => {
    const result = allocateCharacterFilenames([
      buildChar('???', 'minor'),
      buildChar('***', 'minor'),
      buildChar('<<<', 'mentioned')
    ])
    expect(result.filenames.get('???')).toBe('3 - Minor/_unnamed_1')
    expect(result.filenames.get('***')).toBe('3 - Minor/_unnamed_2')
    expect(result.filenames.get('<<<')).toBe('4 - Mentioned/_unnamed_1')
    expect(result.warnings.length).toBeGreaterThanOrEqual(3)
  })
})
