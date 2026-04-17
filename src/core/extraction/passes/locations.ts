import type {
  ExtractedLocationDelta,
  ScrivenerChapter
} from '../../../shared/types'
import type { JSONSchema, JSONSchemaProperty } from '../providers'
import {
  concatenateScenes,
  ensureArray,
  ensureObject,
  ensureString,
  formatChapterHeader,
  priorLocationsBlock,
  priorSummariesBlock,
  type ExtractionContext,
  type PassRunner
} from './common'
import {
  buildCustomFieldsObjectSchema,
  renderCustomFieldsPromptBlock,
  validateCustomFields
} from './customFields'

export type { ExtractedLocationDelta }

export interface LocationsPassResult {
  locations: ExtractedLocationDelta[]
}

const SYSTEM = `You are a literary assistant extracting structured location data from a novel manuscript, one chapter at a time. You have access to a list of locations already identified in previous chapters; prefer linking to existing locations (by canonical name) rather than creating near-duplicates. Return data via the provided tool. Be factual and sparse — do not invent traits not stated or clearly implied in the text.`

const BASE_ITEM_PROPERTIES: Record<string, JSONSchemaProperty> = {
  name: { type: 'string' },
  description: {
    type: 'string',
    description: 'Physical description stated or implied. One paragraph max.'
  },
  significance: {
    type: 'string',
    description: 'Why this location matters to the story so far.'
  },
  isNew: { type: 'boolean' }
}

function buildLocationsSchema(ctx: ExtractionContext): JSONSchema {
  const itemProperties: Record<string, JSONSchemaProperty> = {
    ...BASE_ITEM_PROPERTIES
  }
  if (ctx.customLocationFields.length > 0) {
    itemProperties.customFields = buildCustomFieldsObjectSchema(
      ctx.customLocationFields
    )
  }
  return {
    type: 'object',
    properties: {
      locations: {
        type: 'array',
        items: {
          type: 'object',
          properties: itemProperties,
          required: ['name', 'description', 'significance', 'isNew']
        }
      }
    },
    required: ['locations']
  }
}

const FALLBACK_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: BASE_ITEM_PROPERTIES,
        required: ['name', 'description', 'significance', 'isNew']
      }
    }
  },
  required: ['locations']
}

export const locationsPass: PassRunner<LocationsPassResult> = {
  name: 'locations',
  toolName: 'record_locations',
  toolDescription:
    'Record every location where scenes take place or that is meaningfully referenced in the current chapter, reusing canonical names from prior chapters when applicable.',
  schema: FALLBACK_SCHEMA,
  buildSchema: buildLocationsSchema,
  buildPrompts(chapter: ScrivenerChapter, ctx: ExtractionContext) {
    const sections = [
      formatChapterHeader(chapter, ctx),
      '',
      'Locations already known:',
      priorLocationsBlock(ctx),
      '',
      'Recent chapter summaries:',
      priorSummariesBlock(ctx),
      '',
      'Chapter text:',
      '---',
      concatenateScenes(chapter),
      '---',
      '',
      'Extract every location where scenes occur or that is meaningfully referenced in this chapter. For locations already known, use their canonical name. For new locations, provide a canonical name.'
    ]
    const customBlock = renderCustomFieldsPromptBlock(ctx.customLocationFields)
    if (customBlock.length > 0) sections.push(customBlock)
    return { systemPrompt: SYSTEM, userPrompt: sections.join('\n') }
  },
  validate(data: unknown, ctx?: ExtractionContext): LocationsPassResult {
    const fieldDefs = ctx?.customLocationFields ?? []
    const obj = ensureObject(data, 'locations pass')
    const raw = ensureArray<Record<string, unknown>>(obj.locations, 'locations[]')
    const locations = raw.map((l, i) => {
      const label = `locations[${i}]`
      const customFields = validateCustomFields(l.customFields, fieldDefs)
      const delta: ExtractedLocationDelta = {
        name: ensureString(l.name, `${label}.name`),
        description: typeof l.description === 'string' ? l.description : '',
        significance: typeof l.significance === 'string' ? l.significance : '',
        isNew: typeof l.isNew === 'boolean' ? l.isNew : true
      }
      if (customFields !== undefined) delta.customFields = customFields
      return delta
    })
    return { locations }
  }
}
