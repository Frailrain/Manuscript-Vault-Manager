import type { ScrivenerChapter } from '../../../shared/types'
import type { JSONSchema } from '../providers'
import {
  concatenateScenes,
  ensureArray,
  ensureObject,
  ensureString,
  ensureStringArray,
  formatChapterHeader,
  priorSummariesBlock,
  type ExtractionContext,
  type PassRunner
} from './common'

export interface TimelinePassResult {
  summary: string
  events: Array<{ summary: string; sequence: number }>
  charactersAppearing: string[]
  locationsAppearing: string[]
}

const SYSTEM = `You are a literary assistant summarising a novel manuscript chapter-by-chapter and indexing the events inside each chapter. Return data via the provided tool. Be concise and stick to what is stated in the text.`

const SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: "2-4 sentences summarising this chapter's events."
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'One sentence describing the event.'
          },
          sequence: {
            type: 'integer',
            minimum: 1,
            description: 'Order within the chapter, starting at 1.'
          }
        },
        required: ['summary', 'sequence']
      }
    },
    charactersAppearing: {
      type: 'array',
      items: { type: 'string' },
      description: 'Canonical names of characters appearing in this chapter.'
    },
    locationsAppearing: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'events', 'charactersAppearing', 'locationsAppearing']
}

export const timelinePass: PassRunner<TimelinePassResult> = {
  name: 'timeline',
  toolName: 'record_timeline',
  toolDescription:
    'Summarise the chapter and list its in-order plot events, plus the characters and locations that appear.',
  schema: SCHEMA,
  buildPrompts(chapter: ScrivenerChapter, ctx: ExtractionContext) {
    const userPrompt = [
      formatChapterHeader(chapter, ctx),
      '',
      'Recent chapter summaries:',
      priorSummariesBlock(ctx),
      '',
      'Chapter text:',
      '---',
      concatenateScenes(chapter),
      '---',
      '',
      'Summarise this chapter in 2-4 sentences. List the plot events in order, numbering them starting at 1. Name the characters and locations that appear, using canonical names from prior chapters where applicable.'
    ].join('\n')
    return { systemPrompt: SYSTEM, userPrompt }
  },
  validate(data: unknown): TimelinePassResult {
    const obj = ensureObject(data, 'timeline pass')
    const summary = typeof obj.summary === 'string' ? obj.summary : ''
    const rawEvents = ensureArray<Record<string, unknown>>(obj.events, 'events[]')
    const events = rawEvents.map((e, i) => {
      const label = `events[${i}]`
      const seq =
        typeof e.sequence === 'number'
          ? Math.max(1, Math.floor(e.sequence))
          : i + 1
      return {
        summary: ensureString(e.summary, `${label}.summary`),
        sequence: seq
      }
    })
    const charactersAppearing = Array.isArray(obj.charactersAppearing)
      ? ensureStringArray(obj.charactersAppearing, 'charactersAppearing')
      : []
    const locationsAppearing = Array.isArray(obj.locationsAppearing)
      ? ensureStringArray(obj.locationsAppearing, 'locationsAppearing')
      : []
    return { summary, events, charactersAppearing, locationsAppearing }
  }
}
