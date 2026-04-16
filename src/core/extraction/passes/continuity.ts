import type { ScrivenerChapter } from '../../../shared/types'
import type { JSONSchema } from '../providers'
import {
  concatenateScenes,
  ensureArray,
  ensureObject,
  ensureString,
  ensureStringArray,
  formatChapterHeader,
  priorCharactersDetailedBlock,
  priorLocationsBlock,
  priorSummariesBlock,
  type ExtractionContext,
  type PassRunner
} from './common'

export type PassContinuitySeverity = 'low' | 'medium' | 'high'

export interface ContinuityPassResult {
  issues: Array<{
    severity: PassContinuitySeverity
    description: string
    suggestion: string
    relatedCharacters: string[]
  }>
}

const SYSTEM = `You are a literary assistant reviewing a novel manuscript chapter-by-chapter for continuity errors — factual contradictions between this chapter and what has been established in prior chapters. Report ONLY clear contradictions stated in the text, not stylistic concerns or potential plot holes. Each issue must name the conflicting facts.`

const SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          description: {
            type: 'string',
            description:
              'What the contradiction is, with specific quotes from the conflicting sources.'
          },
          suggestion: {
            type: 'string',
            description: 'Proposed resolution.'
          },
          relatedCharacters: { type: 'array', items: { type: 'string' } }
        },
        required: ['severity', 'description', 'suggestion', 'relatedCharacters']
      }
    }
  },
  required: ['issues']
}

export const continuityPass: PassRunner<ContinuityPassResult> = {
  name: 'continuity',
  toolName: 'record_continuity_issues',
  toolDescription:
    'Record continuity errors between this chapter and what has been established in earlier chapters. Return an empty array if none are found.',
  schema: SCHEMA,
  buildPrompts(chapter: ScrivenerChapter, ctx: ExtractionContext) {
    const userPrompt = [
      formatChapterHeader(chapter, ctx),
      '',
      'Characters established so far (with full descriptions):',
      priorCharactersDetailedBlock(ctx),
      '',
      'Locations established so far:',
      priorLocationsBlock(ctx),
      '',
      'Recent chapter summaries:',
      priorSummariesBlock(ctx),
      '',
      'Current chapter text:',
      '---',
      concatenateScenes(chapter),
      '---',
      '',
      'Check for contradictions between this chapter and prior-chapter facts: shifted physical descriptions, impossible timelines, relationship contradictions, location details that do not match. Report only clear contradictions, not stylistic concerns. If none, return an empty issues array.'
    ].join('\n')
    return { systemPrompt: SYSTEM, userPrompt }
  },
  validate(data: unknown): ContinuityPassResult {
    const obj = ensureObject(data, 'continuity pass')
    const raw = ensureArray<Record<string, unknown>>(obj.issues, 'issues[]')
    const issues = raw.map((issue, i) => {
      const label = `issues[${i}]`
      const severityRaw = issue.severity
      const severity: PassContinuitySeverity =
        severityRaw === 'low' || severityRaw === 'medium' || severityRaw === 'high'
          ? severityRaw
          : 'low'
      return {
        severity,
        description: ensureString(issue.description, `${label}.description`),
        suggestion: ensureString(issue.suggestion, `${label}.suggestion`),
        relatedCharacters: Array.isArray(issue.relatedCharacters)
          ? ensureStringArray(issue.relatedCharacters, `${label}.relatedCharacters`)
          : []
      }
    })
    return { issues }
  }
}
