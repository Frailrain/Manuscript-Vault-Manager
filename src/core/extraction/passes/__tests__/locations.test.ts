import { describe, expect, it } from 'vitest'

import type { ScrivenerChapter } from '../../../../shared/types'
import type { ExtractionContext } from '../common'
import { locationsPass } from '../locations'

function makeChapter(): ScrivenerChapter {
  return {
    uuid: 'ch-1',
    title: 'Test Chapter',
    order: 1,
    parentTitle: null,
    synopsis: null,
    label: null,
    status: null,
    scenes: [
      {
        uuid: 'scene-1',
        title: 'Only scene',
        order: 1,
        content: 'They entered the throne room.',
        wordCount: 5,
        contentHash: 'hash',
        synopsis: null,
        label: null,
        status: null
      }
    ]
  }
}

function makeCtx(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
  return {
    projectName: 'Test Novel',
    priorCharacters: [],
    priorCharactersDetailed: [],
    priorLocations: [],
    priorChapterSummaries: [],
    priorChapterHeadlines: [],
    currentChapterOrder: 1,
    totalChapters: 1,
    customCharacterFields: [],
    customLocationFields: [],
    glossary: [],
    ...overrides
  }
}

describe('locationsPass schema', () => {
  it('declares parentLocation as a required nullable string', () => {
    const ctx = makeCtx()
    const schema = locationsPass.buildSchema!(ctx) as unknown as {
      properties: {
        locations: {
          items: {
            properties: { parentLocation?: { type: unknown } }
            required: string[]
          }
        }
      }
    }
    const item = schema.properties.locations.items
    expect(item.required).toContain('parentLocation')
    expect(item.properties.parentLocation?.type).toEqual(['string', 'null'])
  })
})

describe('locationsPass system prompt', () => {
  it('includes sub-location guidance and the canonical-parent rule', () => {
    const ctx = makeCtx()
    const { systemPrompt } = locationsPass.buildPrompts(makeChapter(), ctx)
    expect(systemPrompt.toLowerCase()).toContain('sub-location')
    expect(systemPrompt).toContain('parentLocation')
    expect(systemPrompt.toLowerCase()).toContain('top-level')
  })
})

describe('locationsPass user prompt', () => {
  it('prepends the glossary block when ctx.glossary is non-empty', () => {
    const ctx = makeCtx({
      glossary: [{ term: 'realm', meaning: 'A sovereign magical region.' }]
    })
    const { userPrompt } = locationsPass.buildPrompts(makeChapter(), ctx)
    expect(userPrompt).toContain('Genre vocabulary')
    expect(userPrompt).toContain('**realm**')
  })
})

describe('locationsPass validate', () => {
  it('defaults missing parentLocation to null', () => {
    const result = locationsPass.validate({
      locations: [
        {
          name: 'The Tower',
          description: 'Tall.',
          significance: '',
          isNew: true
        }
      ]
    })
    expect(result.locations[0]!.parentLocation).toBeNull()
  })

  it('trims and keeps a string parentLocation', () => {
    const result = locationsPass.validate({
      locations: [
        {
          name: 'Throne Room',
          description: '',
          significance: '',
          isNew: true,
          parentLocation: '  Iron Palace  '
        }
      ]
    })
    expect(result.locations[0]!.parentLocation).toBe('Iron Palace')
  })

  it('treats an empty-string parentLocation as null', () => {
    const result = locationsPass.validate({
      locations: [
        {
          name: 'The Tower',
          description: '',
          significance: '',
          isNew: true,
          parentLocation: '   '
        }
      ]
    })
    expect(result.locations[0]!.parentLocation).toBeNull()
  })
})
