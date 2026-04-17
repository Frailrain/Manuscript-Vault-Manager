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
  renderGlossaryBlock,
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

const SYSTEM = `You are a literary assistant extracting structured character data from a novel manuscript, one chapter at a time. You have access to a list of characters already identified in previous chapters; prefer linking to existing characters (by canonical name) rather than creating near-duplicates. Return data via the provided tool. Be factual and sparse — do not invent traits not stated or clearly implied in the text.

For each character, provide two distinct fields:
- **description**: who the character is — appearance, personality, background. This is their enduring identity. Do not describe events from this chapter here.
- **chapterActivity**: what they do in this chapter. Refer to events and other characters by name. If the character is only mentioned in passing without acting, use an empty string.

The description will be merged across chapters; chapterActivity is captured per-chapter and displayed separately.

When classifying characters into tiers:
- A **main** character is the protagonist, primary antagonist, or a member of the core cast whose arc the book is fundamentally about. Typically fewer than 5 characters per novel.
- A **secondary** character appears across multiple chapters, has a meaningful story role (mentor, love interest, rival, foil), but the book is not about them.
- A **minor** character is named and actually appears on-page in at least one scene, doing something, even briefly. Shopkeepers with dialogue, guards who stop the protagonist, one-off encounters who speak.
- A **mentioned** character is named but never appears on-page as an actor. They're referenced in dialogue ("my sister Sarah said..."), memory ("I remember what Father used to say..."), or narrative context ("the High Chancellor had issued the edict last year") without ever being present in a scene.

When in doubt between main and secondary, choose secondary. When in doubt between secondary and minor, choose secondary. When in doubt between minor and mentioned, choose minor (if the character does any action, even off-page but in the current narrative, they're minor).`

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
      'Durable identity traits — physical appearance and personality characteristics — stated or implied in this chapter. Avoid mentioning events of the chapter here; focus on who the character IS, not what they do. One paragraph max.'
  },
  chapterActivity: {
    type: 'string',
    description:
      "What this character does, experiences, or becomes in this specific chapter. Reference events and other characters by name. Example: 'Confronts Vorn in the tower. Loses her staff during the fight. Learns that the Archivist has been manipulating her.' Use an empty string if the character is merely mentioned but does not act. Two sentences maximum."
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
  },
  tier: {
    type: 'string',
    enum: ['main', 'secondary', 'minor', 'mentioned'],
    description:
      "Main = protagonist or primary cast, appears frequently and drives plot. Secondary = recurring character with meaningful story role but not central. Minor = named character who appears in at least one scene and does something, even briefly (shopkeeper, guard, contact, one-off encounter). Mentioned = named character who is only referred to in dialogue, memory, or narrative \u2014 never appears on-page as an actor in any scene."
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
            'chapterActivity',
            'role',
            'relationships',
            'isNew',
            'tier'
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
          'chapterActivity',
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
      'Extract every character appearing or meaningfully referenced in this chapter. For characters already known, use their canonical name. For new characters, provide a canonical name and any aliases. Classify each character by tier (main / secondary / minor). Keep description focused on identity; put what the character does in this chapter under chapterActivity.'
    ]
    const customBlock = renderCustomFieldsPromptBlock(ctx.customCharacterFields)
    if (customBlock.length > 0) sections.push(customBlock)
    const userPrompt = renderGlossaryBlock(ctx.glossary) + sections.join('\n')
    return { systemPrompt: SYSTEM, userPrompt }
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
        chapterActivity:
          typeof c.chapterActivity === 'string' ? c.chapterActivity : '',
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
        isNew: typeof c.isNew === 'boolean' ? c.isNew : true,
        tier:
          c.tier === 'main' ||
          c.tier === 'secondary' ||
          c.tier === 'minor' ||
          c.tier === 'mentioned'
            ? c.tier
            : 'minor'
      }
      if (customFields !== undefined) delta.customFields = customFields
      return delta
    })
    return { characters }
  }
}
