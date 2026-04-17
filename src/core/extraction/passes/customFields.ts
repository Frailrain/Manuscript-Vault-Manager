import type { CustomFieldValue } from '../../../shared/types'
import type { GenreFieldDef } from '../../../shared/presets'
import type { JSONSchemaProperty } from '../providers'

/**
 * Build a JSONSchema property for the object of custom fields attached to a
 * character or location, based on the user-configured field definitions.
 * All fields are optional — the LLM may not have info for every field.
 */
export function buildCustomFieldsObjectSchema(
  fieldDefs: GenreFieldDef[]
): JSONSchemaProperty {
  const properties: Record<string, JSONSchemaProperty> = {}
  for (const def of fieldDefs) {
    properties[def.key] = buildFieldSchema(def)
  }
  return {
    type: 'object',
    properties,
    description:
      'Optional genre-specific fields. Omit any field you cannot determine from the chapter text.'
  }
}

function buildFieldSchema(field: GenreFieldDef): JSONSchemaProperty {
  switch (field.type) {
    case 'text':
      return { type: 'string', description: field.description }
    case 'number':
      return { type: 'number', description: field.description }
    case 'list':
      return {
        type: 'array',
        items: { type: 'string' },
        description: field.description
      }
  }
}

/**
 * Render the prompt guidance for custom fields, or empty string when none.
 */
export function renderCustomFieldsPromptBlock(
  fieldDefs: GenreFieldDef[]
): string {
  if (fieldDefs.length === 0) return ''
  const lines = fieldDefs.map(
    (f) => `- **${f.label}** (${f.type}): ${f.description}`
  )
  return [
    '',
    'Additionally, extract the following genre-specific information where available:',
    ...lines,
    '',
    'Include these under a `customFields` object on each record. If you cannot determine a field\'s value from the chapter text, omit it entirely — do not guess or make up values.'
  ].join('\n')
}

/**
 * Validate and coerce raw LLM customFields output against the field defs.
 * Returns `undefined` when no fields configured. Unknown keys are dropped.
 */
export function validateCustomFields(
  raw: unknown,
  fieldDefs: GenreFieldDef[]
): Record<string, CustomFieldValue> | undefined {
  if (fieldDefs.length === 0) return undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const input = raw as Record<string, unknown>
  const out: Record<string, CustomFieldValue> = {}
  for (const def of fieldDefs) {
    const value = input[def.key]
    if (value === undefined || value === null) continue
    if (def.type === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        out[def.key] = value
      }
    } else if (def.type === 'text') {
      if (typeof value === 'string' && value.trim().length > 0) {
        out[def.key] = value.trim()
      }
    } else if (def.type === 'list') {
      if (Array.isArray(value)) {
        const strs = value.filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        )
        if (strs.length > 0) out[def.key] = strs
      }
    }
  }
  return out
}
