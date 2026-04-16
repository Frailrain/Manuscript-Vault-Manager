import type {
  ExtractedLocationDelta,
  ScrivenerChapter
} from '../../../shared/types'
import type { JSONSchema } from '../providers'
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

export type { ExtractedLocationDelta }

export interface LocationsPassResult {
  locations: ExtractedLocationDelta[]
}

const SYSTEM = `You are a literary assistant extracting structured location data from a novel manuscript, one chapter at a time. You have access to a list of locations already identified in previous chapters; prefer linking to existing locations (by canonical name) rather than creating near-duplicates. Return data via the provided tool. Be factual and sparse — do not invent traits not stated or clearly implied in the text.`

const SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
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
        },
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
  schema: SCHEMA,
  buildPrompts(chapter: ScrivenerChapter, ctx: ExtractionContext) {
    const userPrompt = [
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
    ].join('\n')
    return { systemPrompt: SYSTEM, userPrompt }
  },
  validate(data: unknown): LocationsPassResult {
    const obj = ensureObject(data, 'locations pass')
    const raw = ensureArray<Record<string, unknown>>(obj.locations, 'locations[]')
    const locations = raw.map((l, i) => {
      const label = `locations[${i}]`
      return {
        name: ensureString(l.name, `${label}.name`),
        description: typeof l.description === 'string' ? l.description : '',
        significance: typeof l.significance === 'string' ? l.significance : '',
        isNew: typeof l.isNew === 'boolean' ? l.isNew : true
      }
    })
    return { locations }
  }
}
