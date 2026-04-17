import { describe, expect, it } from 'vitest'

import type { ScrivenerChapter } from '../../../../shared/types'
import { charactersPass } from '../characters'
import type { ExtractionContext } from '../common'

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
        content: 'Elara walked into the tower.',
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

describe('charactersPass schema', () => {
  it('declares tier as a required enum of main/secondary/minor', () => {
    const ctx = makeCtx()
    const schema = charactersPass.buildSchema!(ctx) as unknown as {
      properties: {
        characters: {
          items: {
            properties: { tier?: { enum?: string[] } }
            required: string[]
          }
        }
      }
    }
    const item = schema.properties.characters.items
    expect(item.required).toContain('tier')
    expect(item.properties.tier?.enum).toEqual(['main', 'secondary', 'minor'])
  })

  it('includes chapterActivity as a required string property', () => {
    const ctx = makeCtx()
    const schema = charactersPass.buildSchema!(ctx) as unknown as {
      properties: {
        characters: {
          items: {
            properties: { chapterActivity?: { type?: string; description?: string } }
            required: string[]
          }
        }
      }
    }
    const item = schema.properties.characters.items
    expect(item.required).toContain('chapterActivity')
    expect(item.properties.chapterActivity?.type).toBe('string')
    expect(item.properties.chapterActivity?.description?.toLowerCase()).toContain(
      'chapter'
    )
  })
})

describe('charactersPass system prompt', () => {
  it('includes tier-classification guidance with the secondary-bias rule', () => {
    const ctx = makeCtx()
    const { systemPrompt } = charactersPass.buildPrompts(makeChapter(), ctx)
    expect(systemPrompt).toContain('main')
    expect(systemPrompt).toContain('secondary')
    expect(systemPrompt).toContain('minor')
    expect(systemPrompt.toLowerCase()).toContain('when in doubt')
  })

  it('explains the split between description (identity) and chapterActivity', () => {
    const ctx = makeCtx()
    const { systemPrompt } = charactersPass.buildPrompts(makeChapter(), ctx)
    expect(systemPrompt).toContain('description')
    expect(systemPrompt).toContain('chapterActivity')
    expect(systemPrompt.toLowerCase()).toContain('identity')
  })
})

describe('charactersPass user prompt', () => {
  it('prepends the glossary block when ctx.glossary is non-empty', () => {
    const ctx = makeCtx({
      glossary: [{ term: 'boss', meaning: 'A high-tier monster.' }]
    })
    const { userPrompt } = charactersPass.buildPrompts(makeChapter(), ctx)
    expect(userPrompt).toContain('Genre vocabulary')
    expect(userPrompt).toContain('**boss**')
    expect(userPrompt.indexOf('Genre vocabulary')).toBeLessThan(
      userPrompt.indexOf('Test Chapter')
    )
  })

  it('omits the glossary block when ctx.glossary is empty', () => {
    const ctx = makeCtx()
    const { userPrompt } = charactersPass.buildPrompts(makeChapter(), ctx)
    expect(userPrompt).not.toContain('Genre vocabulary')
  })
})

describe('charactersPass validate', () => {
  it('defaults missing tier to minor', () => {
    const result = charactersPass.validate({
      characters: [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true
        }
      ]
    })
    expect(result.characters[0]!.tier).toBe('minor')
  })

  it('keeps a valid tier value as-is', () => {
    const result = charactersPass.validate({
      characters: [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          tier: 'main'
        }
      ]
    })
    expect(result.characters[0]!.tier).toBe('main')
  })

  it('accepts an empty-string chapterActivity', () => {
    const result = charactersPass.validate({
      characters: [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          chapterActivity: '',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          tier: 'main'
        }
      ]
    })
    expect(result.characters[0]!.chapterActivity).toBe('')
  })

  it('coerces missing chapterActivity to empty string', () => {
    const result = charactersPass.validate({
      characters: [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          tier: 'main'
        }
      ]
    })
    expect(result.characters[0]!.chapterActivity).toBe('')
  })

  it('preserves a non-empty chapterActivity as-is', () => {
    const result = charactersPass.validate({
      characters: [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          chapterActivity: 'Enters the tower. Confronts the scholar.',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          tier: 'main'
        }
      ]
    })
    expect(result.characters[0]!.chapterActivity).toBe(
      'Enters the tower. Confronts the scholar.'
    )
  })
})
