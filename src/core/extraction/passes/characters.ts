import type {
  ExtractedCharacterDelta,
  ScrivenerChapter
} from '../../../shared/types'
import type { JSONSchema, JSONSchemaProperty } from '../providers'
import {
  concatenateScenes,
  ensureArray,
  ensureObject,
  ensureString,
  ensureStringArray,
  formatChapterHeader,
  priorCharactersBlock,
  priorSummariesBlock,
  type ExtractionContext,
  type PassRunner
} from './common'
import {
  buildCustomFieldsObjectSchema,
  renderCustomFieldsPromptBlock,
  validateCustomFields
} from './customFields'

export type { ExtractedCharacterDelta }

export interface CharactersPassResult {
  characters: ExtractedCharacterDelta[]
}

const SYSTEM = `You are a literary assistant extracting structured character data from a novel manuscript, one chapter at a time. You have access to a list of characters already identified in previous chapters; prefer linking to existing characters (by canonical name) rather than creating near-duplicates. Return data via the provided tool. Be factual and sparse — do not invent traits not stated or clearly implied in the text.`

const BASE_ITEM_PROPERTIES: Record<string, JSONSchemaProperty> = {
  name: {
    type: 'string',
    description:
      'Canonical name. Use the existing canonical name if this character was in the prior list.'
  },
  aliases: {
    type: 'array',
    items: { type: 'string' },
    description: 'Other names used for this character.'
  },
  description: {
    type: 'string',
    description:
      'Physical appearance and personality traits stated or implied in this chapter. One paragraph max.'
  },
  role: {
    type: 'string',
    description:
      "Role in the story, e.g. \"protagonist\", \"antagonist's lieutenant\", \"innkeeper\"."
  },
  relationships: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        relationship: { type: 'string' }
      },
      required: ['name', 'relationship']
    }
  },
  isNew: {
    type: 'boolean',
    description: 'True if this character was not in the prior character list.'
  }
}

function buildCharactersSchema(ctx: ExtractionContext): JSONSchema {
  const itemProperties: Record<string, JSONSchemaProperty> = {
    ...BASE_ITEM_PROPERTIES
  }
  if (ctx.customCharacterFields.length > 0) {
    itemProperties.customFields = buildCustomFieldsObjectSchema(
      ctx.customCharacterFields
    )
  }
  return {
    type: 'object',
    properties: {
      characters: {
        type: 'array',
        items: {
          type: 'object',
          properties: itemProperties,
          required: [
            'name',
            'aliases',
            'description',
            'role',
            'relationships',
            'isNew'
          ]
        }
      }
    },
    required: ['characters']
  }
}

const FALLBACK_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: BASE_ITEM_PROPERTIES,
        required: [
          'name',
          'aliases',
          'description',
          'role',
          'relationships',
          'isNew'
        ]
      }
    }
  },
  required: ['characters']
}

export const charactersPass: PassRunner<CharactersPassResult> = {
  name: 'characters',
  toolName: 'record_characters',
  toolDescription:
    'Record every character that appears in the current chapter, reusing canonical names from prior chapters when applicable.',
  schema: FALLBACK_SCHEMA,
  buildSchema: buildCharactersSchema,
  buildPrompts(chapter: ScrivenerChapter, ctx: ExtractionContext) {
    const sections = [
      formatChapterHeader(chapter, ctx),
      '',
      'Characters already known:',
      priorCharactersBlock(ctx),
      '',
      'Recent chapter summaries:',
      priorSummariesBlock(ctx),
      '',
      'Chapter text:',
      '---',
      concatenateScenes(chapter),
      '---',
      '',
      'Extract every character appearing or meaningfully referenced in this chapter. For characters already known, use their canonical name. For new characters, provide a canonical name and any aliases.'
    ]
    const customBlock = renderCustomFieldsPromptBlock(ctx.customCharacterFields)
    if (customBlock.length > 0) sections.push(customBlock)
    return { systemPrompt: SYSTEM, userPrompt: sections.join('\n') }
  },
  validate(data: unknown, ctx?: ExtractionContext): CharactersPassResult {
    const fieldDefs = ctx?.customCharacterFields ?? []
    const obj = ensureObject(data, 'characters pass')
    const raw = ensureArray<Record<string, unknown>>(obj.characters, 'characters[]')
    const characters = raw.map((c, i) => {
      const label = `characters[${i}]`
      const customFields = validateCustomFields(c.customFields, fieldDefs)
      const delta: ExtractedCharacterDelta = {
        name: ensureString(c.name, `${label}.name`),
        aliases: Array.isArray(c.aliases)
          ? ensureStringArray(c.aliases, `${label}.aliases`)
          : [],
        description: typeof c.description === 'string' ? c.description : '',
        role: typeof c.role === 'string' ? c.role : '',
        relationships: Array.isArray(c.relationships)
          ? c.relationships
              .filter(
                (r): r is Record<string, unknown> =>
                  !!r && typeof r === 'object' && !Array.isArray(r)
              )
              .map((r, j) => ({
                name: ensureString(r.name, `${label}.relationships[${j}].name`),
                relationship: ensureString(
                  r.relationship,
                  `${label}.relationships[${j}].relationship`
                )
              }))
          : [],
        isNew: typeof c.isNew === 'boolean' ? c.isNew : true
      }
      if (customFields !== undefined) delta.customFields = customFields
      return delta
    })
    return { characters }
  }
}
