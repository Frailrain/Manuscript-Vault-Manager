import { describe, expect, it } from 'vitest'

import type { GenreFieldDef } from '../../../../shared/presets'
import {
  buildCustomFieldsObjectSchema,
  renderCustomFieldsPromptBlock,
  validateCustomFields
} from '../customFields'

const SAMPLE_FIELDS: GenreFieldDef[] = [
  { key: 'level', label: 'Level', type: 'number', description: 'Current level.' },
  { key: 'class', label: 'Class', type: 'text', description: 'Class or path.' },
  {
    key: 'spells',
    label: 'Spells',
    type: 'list',
    description: 'Named spells.'
  }
]

describe('buildCustomFieldsObjectSchema', () => {
  it('emits an object property with entries per field', () => {
    const schema = buildCustomFieldsObjectSchema(SAMPLE_FIELDS)
    expect(schema.type).toBe('object')
    const props = (schema as { properties: Record<string, unknown> }).properties
    expect(Object.keys(props)).toEqual(['level', 'class', 'spells'])
  })

  it('maps number/text/list field types to matching JSONSchema shapes', () => {
    const schema = buildCustomFieldsObjectSchema(SAMPLE_FIELDS)
    const props = (schema as {
      properties: Record<string, { type: string; items?: { type: string } }>
    }).properties
    expect(props.level!.type).toBe('number')
    expect(props.class!.type).toBe('string')
    expect(props.spells!.type).toBe('array')
    expect(props.spells!.items?.type).toBe('string')
  })

  it('returns an empty-properties object when no fields configured', () => {
    const schema = buildCustomFieldsObjectSchema([])
    const props = (schema as { properties: Record<string, unknown> }).properties
    expect(Object.keys(props)).toEqual([])
  })
})

describe('renderCustomFieldsPromptBlock', () => {
  it('returns empty string when no fields', () => {
    expect(renderCustomFieldsPromptBlock([])).toBe('')
  })

  it('mentions each field label, type, and description', () => {
    const text = renderCustomFieldsPromptBlock(SAMPLE_FIELDS)
    expect(text).toContain('Level')
    expect(text).toContain('(number)')
    expect(text).toContain('Current level.')
    expect(text).toContain('Spells')
    expect(text).toContain('(list)')
    expect(text).toContain('customFields')
  })
})

describe('validateCustomFields', () => {
  it('returns undefined when no fields configured', () => {
    expect(validateCustomFields({ level: 5 }, [])).toBeUndefined()
  })

  it('returns empty object when raw is not an object', () => {
    expect(validateCustomFields(null, SAMPLE_FIELDS)).toEqual({})
    expect(validateCustomFields('nope', SAMPLE_FIELDS)).toEqual({})
    expect(validateCustomFields([1, 2], SAMPLE_FIELDS)).toEqual({})
  })

  it('keeps known keys with the right type', () => {
    const out = validateCustomFields(
      { level: 7, class: 'Ranger', spells: ['Arrow', 'Track'] },
      SAMPLE_FIELDS
    )
    expect(out).toEqual({ level: 7, class: 'Ranger', spells: ['Arrow', 'Track'] })
  })

  it('drops unknown keys', () => {
    const out = validateCustomFields(
      { level: 5, nonsense: 'nope' },
      SAMPLE_FIELDS
    )
    expect(out).toEqual({ level: 5 })
  })

  it('drops values with the wrong type', () => {
    const out = validateCustomFields(
      { level: 'five', class: 42, spells: 'Arrow' },
      SAMPLE_FIELDS
    )
    expect(out).toEqual({})
  })

  it('trims text values and drops empty strings', () => {
    const out = validateCustomFields(
      { class: '  Mage  ' },
      SAMPLE_FIELDS
    )
    expect(out).toEqual({ class: 'Mage' })

    const empty = validateCustomFields({ class: '   ' }, SAMPLE_FIELDS)
    expect(empty).toEqual({})
  })

  it('filters non-string list members', () => {
    const out = validateCustomFields(
      { spells: ['Arrow', 7, null, 'Track'] },
      SAMPLE_FIELDS
    )
    expect(out).toEqual({ spells: ['Arrow', 'Track'] })
  })

  it('drops non-finite numbers', () => {
    const out = validateCustomFields(
      { level: Number.POSITIVE_INFINITY },
      SAMPLE_FIELDS
    )
    expect(out).toEqual({})
  })
})
