import { describe, expect, it } from 'vitest'

import {
  cloneFields,
  deriveFieldKey,
  fieldsMatchPreset,
  findPreset,
  GENRE_PRESETS,
  type GenreFieldDef
} from '../presets'

describe('GENRE_PRESETS', () => {
  it('includes all expected presets', () => {
    const ids = GENRE_PRESETS.map((p) => p.id)
    expect(ids).toContain('none')
    expect(ids).toContain('litrpg')
    expect(ids).toContain('romantasy')
    expect(ids).toContain('mystery')
    expect(ids).toContain('epic-fantasy')
    expect(ids).toContain('custom')
  })

  it('none preset has empty field arrays', () => {
    const none = findPreset('none')!
    expect(none.characterFields).toEqual([])
    expect(none.locationFields).toEqual([])
  })

  it('litrpg has level as number and spells-abilities as list', () => {
    const preset = findPreset('litrpg')!
    const level = preset.characterFields.find((f) => f.key === 'level')
    expect(level?.type).toBe('number')
    const spells = preset.characterFields.find(
      (f) => f.key === 'spells-abilities'
    )
    expect(spells?.type).toBe('list')
  })

  it('every field key is in the hyphenated machine-key form', () => {
    for (const preset of GENRE_PRESETS) {
      for (const field of [
        ...preset.characterFields,
        ...preset.locationFields
      ]) {
        expect(field.key).toBe(deriveFieldKey(field.label))
      }
    }
  })
})

describe('deriveFieldKey', () => {
  it('lowercases and hyphenates multi-word labels', () => {
    expect(deriveFieldKey('Danger Level')).toBe('danger-level')
    expect(deriveFieldKey('Romantic Interest')).toBe('romantic-interest')
  })

  it('strips non-alphanumeric characters', () => {
    expect(deriveFieldKey('Hit Points / HP!')).toBe('hit-points-hp')
  })

  it('trims leading and trailing hyphens', () => {
    expect(deriveFieldKey('  Stats  ')).toBe('stats')
    expect(deriveFieldKey('!!!Level!!!')).toBe('level')
  })
})

describe('findPreset', () => {
  it('returns undefined for an unknown id', () => {
    expect(findPreset('does-not-exist')).toBeUndefined()
  })

  it('returns the preset by id', () => {
    expect(findPreset('litrpg')?.name).toContain('LitRPG')
  })
})

describe('fieldsMatchPreset', () => {
  const preset = findPreset('litrpg')!

  it('returns true for an exact copy of the preset fields', () => {
    expect(
      fieldsMatchPreset(
        cloneFields(preset.characterFields),
        cloneFields(preset.locationFields),
        preset
      )
    ).toBe(true)
  })

  it('returns false when a field has been removed', () => {
    const reducedChar = preset.characterFields.slice(0, -1)
    expect(
      fieldsMatchPreset(reducedChar, cloneFields(preset.locationFields), preset)
    ).toBe(false)
  })

  it('returns false when a description has been edited', () => {
    const tweaked: GenreFieldDef[] = preset.characterFields.map((f, i) =>
      i === 0 ? { ...f, description: 'different' } : { ...f }
    )
    expect(
      fieldsMatchPreset(tweaked, cloneFields(preset.locationFields), preset)
    ).toBe(false)
  })
})

describe('cloneFields', () => {
  it('returns a new array with new objects', () => {
    const preset = findPreset('litrpg')!
    const copy = cloneFields(preset.characterFields)
    expect(copy).not.toBe(preset.characterFields)
    expect(copy[0]).not.toBe(preset.characterFields[0])
    expect(copy).toEqual(preset.characterFields)
  })
})
