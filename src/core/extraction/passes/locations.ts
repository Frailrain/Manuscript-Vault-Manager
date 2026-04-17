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
  renderGlossaryBlock,
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

const SYSTEM = `You are a literary assistant extracting structured location data from a novel manuscript, one chapter at a time. You have access to a list of locations already identified in previous chapters; prefer linking to existing locations (by canonical name) rather than creating near-duplicates. Return data via the provided tool. Be factual and sparse — do not invent traits not stated or clearly implied in the text.

Sub-locations: if a location you extract is a named area *within* another location you've also identified (now or in a prior chapter), set its parentLocation field to the parent's canonical name. Examples: a "market square" inside a "city" is a sub-location. A "throne room" inside a "palace" is a sub-location. The "forest" and the "city" themselves are top-level.

Rules:
- Only use parentLocation when the relationship is explicit in the text — don't invent hierarchies.
- Prefer the canonical parent name from the prior-locations list when available.
- If the parent hasn't been extracted yet (i.e. current chapter is where both are first mentioned), still set parentLocation to the parent's name as used in this chapter.
- Top-level locations (cities, regions, forests, planets, realms) have parentLocation: null.`

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
  isNew: { type: 'boolean' },
  parentLocation: {
    type: ['string', 'null'],
    description:
      'Name of the containing/parent location if this is a named sub-area (e.g. "Defensive Line" whose parent is "Ganston\'s Crossing"). Use the canonical parent name from the prior-locations list if the parent has been identified in earlier chapters. Use null if this is a top-level location.'
  }
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
          required: [
            'name',
            'description',
            'significance',
            'isNew',
            'parentLocation'
          ]
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
      'Extract every location where scenes occur or that is meaningfully referenced in this chapter. For locations already known, use their canonical name. For new locations, provide a canonical name. Set parentLocation when this place is a named sub-area of another location; use null for top-level locations.'
    ]
    const customBlock = renderCustomFieldsPromptBlock(ctx.customLocationFields)
    if (customBlock.length > 0) sections.push(customBlock)
    const userPrompt = renderGlossaryBlock(ctx.glossary) + sections.join('\n')
    return { systemPrompt: SYSTEM, userPrompt }
  },
  validate(data: unknown, ctx?: ExtractionContext): LocationsPassResult {
    const fieldDefs = ctx?.customLocationFields ?? []
    const obj = ensureObject(data, 'locations pass')
    const raw = ensureArray<Record<string, unknown>>(obj.locations, 'locations[]')
    const locations = raw.map((l, i) => {
      const label = `locations[${i}]`
      const customFields = validateCustomFields(l.customFields, fieldDefs)
      const rawParent = l.parentLocation
      const parentLocation =
        typeof rawParent === 'string' && rawParent.trim().length > 0
          ? rawParent.trim()
          : null
      const delta: ExtractedLocationDelta = {
        name: ensureString(l.name, `${label}.name`),
        description: typeof l.description === 'string' ? l.description : '',
        significance: typeof l.significance === 'string' ? l.significance : '',
        isNew: typeof l.isNew === 'boolean' ? l.isNew : true,
        parentLocation
      }
      if (customFields !== undefined) delta.customFields = customFields
      return delta
    })
    return { locations }
  }
}
