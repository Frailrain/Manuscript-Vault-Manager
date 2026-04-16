import { describe, expect, it } from 'vitest'

import {
  chapterFilename,
  FilenameAllocator,
  sanitizeFilename
} from '../filenames'

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
