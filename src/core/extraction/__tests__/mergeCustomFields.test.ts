import { describe, expect, it } from 'vitest'

import type { GenreFieldDef } from '../../../shared/presets'
import type { CustomFieldValue } from '../../../shared/types'
import { mergeCustomFields } from '../merge'

const FIELDS: GenreFieldDef[] = [
  { key: 'level', label: 'Level', type: 'number', description: '' },
  { key: 'class', label: 'Class', type: 'text', description: '' },
  { key: 'spells', label: 'Spells', type: 'list', description: '' }
]

describe('mergeCustomFields', () => {
  it('returns a copy of existing when incoming is undefined', () => {
    const existing = { level: 3 }
    const out = mergeCustomFields(existing, undefined, FIELDS)
    expect(out).toEqual({ level: 3 })
    expect(out).not.toBe(existing)
  })

  it('unions list values and dedupes', () => {
    const out = mergeCustomFields(
      { spells: ['Arrow', 'Track'] },
      { spells: ['Track', 'Heal'] },
      FIELDS
    )
    expect(out.spells).toEqual(['Arrow', 'Track', 'Heal'])
  })

  it('last-write-wins for numbers', () => {
    const out = mergeCustomFields({ level: 3 }, { level: 7 }, FIELDS)
    expect(out.level).toBe(7)
  })

  it('last non-empty string wins for text', () => {
    const first = mergeCustomFields({ class: 'Novice' }, { class: 'Mage' }, FIELDS)
    expect(first.class).toBe('Mage')
    const keep = mergeCustomFields({ class: 'Mage' }, { class: '   ' }, FIELDS)
    expect(keep.class).toBe('Mage')
  })

  it('drops unknown keys from incoming', () => {
    const out = mergeCustomFields(
      { level: 1 },
      { level: 2, bogus: 'nope' } as unknown as Record<string, CustomFieldValue>,
      FIELDS
    )
    expect(out).toEqual({ level: 2 })
  })

  it('initialises new keys from an empty existing', () => {
    const out = mergeCustomFields({}, { level: 1, class: 'Bard' }, FIELDS)
    expect(out).toEqual({ level: 1, class: 'Bard' })
  })

  it('ignores non-finite numbers in incoming', () => {
    const out = mergeCustomFields(
      { level: 2 },
      { level: Number.NaN },
      FIELDS
    )
    expect(out).toEqual({ level: 2 })
  })

  it('ignores empty list value in incoming but keeps prior list', () => {
    const out = mergeCustomFields(
      { spells: ['Heal'] },
      { spells: [] },
      FIELDS
    )
    expect(out).toEqual({ spells: ['Heal'] })
  })

  it('with undefined incoming returns a distinct top-level object', () => {
    const existing = { level: 2 }
    const out = mergeCustomFields(existing, undefined, FIELDS)
    out.level = 99
    expect(existing.level).toBe(2)
  })
})
