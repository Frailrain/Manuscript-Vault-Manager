import { describe, expect, it } from 'vitest'

import type { ExtractedCharacter } from '../../../shared/types'
import {
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
  it('maps each tier to its capitalized folder name', () => {
    expect(tierToFolder('main')).toBe('Main')
    expect(tierToFolder('secondary')).toBe('Secondary')
    expect(tierToFolder('minor')).toBe('Minor')
    expect(tierToFolder('mentioned')).toBe('Mentioned')
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
    expect(result.filenames.get('Kiel')).toBe('Main/Kiel')
    expect(result.filenames.get('Ada')).toBe('Secondary/Ada')
    expect(result.filenames.get('Guard')).toBe('Minor/Guard')
    expect(result.filenames.get("Kiel's Mother")).toBe("Mentioned/Kiel's Mother")
    expect(result.warnings).toHaveLength(0)
  })

  it('does not collide two similarly-named characters in different tiers', () => {
    const result = allocateCharacterFilenames([
      buildChar('Amber', 'main'),
      buildChar('Amber?', 'minor')
    ])
    expect(result.filenames.get('Amber')).toBe('Main/Amber')
    expect(result.filenames.get('Amber?')).toBe('Minor/Amber')
  })

  it('suffixes (2) on the second same-tier collision', () => {
    const result = allocateCharacterFilenames([
      { ...buildChar('Amber', 'main'), role: 'knight' },
      { ...buildChar('Amber?', 'main'), role: 'apprentice' }
    ])
    expect(result.filenames.get('Amber')).toBe('Main/Amber')
    expect(result.filenames.get('Amber?')).toBe('Main/Amber (2)')
    expect(result.warnings.some((w) => w.includes('Amber'))).toBe(true)
  })

  it('falls back to _unnamed_N (scoped per tier) for empty names', () => {
    const result = allocateCharacterFilenames([
      buildChar('???', 'minor'),
      buildChar('***', 'minor'),
      buildChar('<<<', 'mentioned')
    ])
    expect(result.filenames.get('???')).toBe('Minor/_unnamed_1')
    expect(result.filenames.get('***')).toBe('Minor/_unnamed_2')
    expect(result.filenames.get('<<<')).toBe('Mentioned/_unnamed_1')
    expect(result.warnings.length).toBeGreaterThanOrEqual(3)
  })
})
