import { describe, expect, it } from 'vitest'

import type { GenreFieldDef } from '../../../shared/presets'
import {
  applyCustomFieldsToFrontmatter,
  renderTrackingCallout
} from '../tracking'

const LITRPG_CHAR_FIELDS: GenreFieldDef[] = [
  { key: 'level', label: 'Level', type: 'number', description: '' },
  { key: 'class', label: 'Class', type: 'text', description: '' },
  { key: 'spells', label: 'Spells', type: 'list', description: '' }
]

describe('renderTrackingCallout', () => {
  it('returns null when no fields configured', () => {
    expect(renderTrackingCallout('Character Sheet', [], { level: 3 })).toBeNull()
  })

  it('returns null when section label is empty string', () => {
    expect(
      renderTrackingCallout('', LITRPG_CHAR_FIELDS, { level: 3 })
    ).toBeNull()
  })

  it('returns null when no values match the fields', () => {
    expect(
      renderTrackingCallout('Character Sheet', LITRPG_CHAR_FIELDS, {})
    ).toBeNull()
  })

  it('renders an info callout with the given title', () => {
    const out = renderTrackingCallout(
      'Character Sheet',
      LITRPG_CHAR_FIELDS,
      { level: 5, class: 'Ranger' }
    )
    expect(out).not.toBeNull()
    expect(out).toContain('> [!info] Character Sheet')
    expect(out).toContain('**Level:** 5')
    expect(out).toContain('**Class:** Ranger')
  })

  it('renders list values comma-joined', () => {
    const out = renderTrackingCallout(
      'Character Sheet',
      LITRPG_CHAR_FIELDS,
      { spells: ['Arrow', 'Track', 'Heal'] }
    )
    expect(out).toContain('**Spells:** Arrow, Track, Heal')
  })

  it('skips empty/invalid values', () => {
    const out = renderTrackingCallout(
      'Character Sheet',
      LITRPG_CHAR_FIELDS,
      { level: 3, class: '', spells: [] }
    )
    expect(out).toContain('**Level:** 3')
    expect(out).not.toContain('**Class:**')
    expect(out).not.toContain('**Spells:**')
  })
})

describe('applyCustomFieldsToFrontmatter', () => {
  it('writes the values under their keys by default', () => {
    const fm: Record<string, unknown> = {}
    applyCustomFieldsToFrontmatter(fm, LITRPG_CHAR_FIELDS, {
      level: 5,
      class: 'Ranger',
      spells: ['Arrow', 'Track']
    })
    expect(fm).toEqual({
      level: 5,
      class: 'Ranger',
      spells: ['Arrow', 'Track']
    })
  })

  it('prefixes reserved keys with custom-', () => {
    const reservedKey: GenreFieldDef[] = [
      { key: 'role', label: 'Role', type: 'text', description: '' },
      { key: 'name', label: 'Name', type: 'text', description: '' }
    ]
    const fm: Record<string, unknown> = { type: 'character', name: 'Elara' }
    applyCustomFieldsToFrontmatter(fm, reservedKey, {
      role: 'Tank',
      name: 'Elara Mark II'
    })
    expect(fm['custom-role']).toBe('Tank')
    expect(fm['custom-name']).toBe('Elara Mark II')
    // Original reserved keys untouched.
    expect(fm.name).toBe('Elara')
  })

  it('trims text values and drops empty strings', () => {
    const fm: Record<string, unknown> = {}
    applyCustomFieldsToFrontmatter(fm, LITRPG_CHAR_FIELDS, {
      class: '  Mage  '
    })
    expect(fm.class).toBe('Mage')

    const fm2: Record<string, unknown> = {}
    applyCustomFieldsToFrontmatter(fm2, LITRPG_CHAR_FIELDS, {
      class: '   '
    })
    expect('class' in fm2).toBe(false)
  })

  it('drops non-finite numbers and empty lists', () => {
    const fm: Record<string, unknown> = {}
    applyCustomFieldsToFrontmatter(fm, LITRPG_CHAR_FIELDS, {
      level: Number.POSITIVE_INFINITY,
      spells: []
    })
    expect(Object.keys(fm)).toEqual([])
  })
})
