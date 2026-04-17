import { describe, expect, it } from 'vitest'

import { ExtractionError } from '../errors'
import { runExtractionWithProvider } from '../engine'
import { LLMProviderError } from '../providers'
import type {
  ExtractionProgress,
  ScrivenerChapter,
  ScrivenerProject
} from '../../../shared/types'
import { CHAPTER_TOKEN_SOFT_LIMIT } from '../chunking'
import { makeMiniProject } from './fixtures/mini-project'
import {
  defaultRespond,
  MockProvider,
  OK_CHARACTERS,
  OK_CONTINUITY,
  OK_LOCATIONS,
  OK_TIMELINE
} from './mockProvider'

describe('runExtractionWithProvider', () => {
  it('runs all four passes per chapter on a 2-chapter fixture and produces the expected shape', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    const result = await runExtractionWithProvider(project, mock)

    const toolCalls = mock.calls.map((c) => c.toolName)
    const toolCallCount = (name: string): number =>
      toolCalls.filter((n) => n === name).length
    expect(toolCallCount('record_characters')).toBe(2)
    expect(toolCallCount('record_locations')).toBe(2)
    expect(toolCallCount('record_timeline')).toBe(2)
    expect(toolCallCount('record_continuity_issues')).toBe(2)

    expect(result.tokenUsage.inputTokens).toBe(800)
    expect(result.tokenUsage.outputTokens).toBe(400)
    expect(result.tokenUsage.estimatedCostUSD).toBeGreaterThan(0)

    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0]!.summary).toContain('Silver Tower')
    expect(result.characters.map((c) => c.name)).toContain('Elara')
    expect(result.locations.map((l) => l.name)).toContain('Silver Tower')
    expect(result.timeline).toHaveLength(4)
    expect(result.timeline[0]!.chapterOrder).toBe(1)
    expect(result.timeline[result.timeline.length - 1]!.chapterOrder).toBe(2)
    expect(result.continuityIssues).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('records a passErrors entry when a pass fails for one chapter, and continues extraction', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    mock.respond = (toolName, callIndex) => {
      if (toolName === 'record_locations' && callIndex === 0) {
        return new LLMProviderError('forced parse failure', 'parse')
      }
      return defaultRespond(toolName)
    }

    const result = await runExtractionWithProvider(project, mock)

    expect(result.chapters).toHaveLength(2)
    const ch1 = result.chapters[0]!
    expect(ch1.passErrors).toBeDefined()
    expect(ch1.passErrors?.locations).toContain('forced parse failure')

    const ch2 = result.chapters[1]!
    expect(ch2.passErrors).toBeUndefined()

    expect(result.characters.map((c) => c.name)).toContain('Elara')
    expect(result.timeline).toHaveLength(4)

    expect(result.locations).toHaveLength(1)
    expect(result.locations[0]!.appearances).toEqual([2])

    expect(result.warnings.some((w) => w.includes("pass 'locations'"))).toBe(true)
  })

  it('wraps a first-call auth error as ExtractionError(code=provider)', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    mock.respond = () =>
      new LLMProviderError('bad api key', 'auth')

    await expect(runExtractionWithProvider(project, mock)).rejects.toBeInstanceOf(
      ExtractionError
    )
    try {
      await runExtractionWithProvider(project, mock)
    } catch (err) {
      const e = err as ExtractionError
      expect(e.code).toBe('provider')
      expect(e.message).toContain('credentials')
    }
  })

  it('fires progress callbacks for every phase and every pass of every chapter', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    const events: ExtractionProgress[] = []
    await runExtractionWithProvider(project, mock, {
      onProgress: (p) => events.push(p)
    })

    expect(events.some((e) => e.phase === 'preparing')).toBe(true)
    expect(events.some((e) => e.phase === 'merging')).toBe(true)
    expect(events.some((e) => e.phase === 'done')).toBe(true)

    for (const chapter of [1, 2]) {
      for (const pass of [
        'characters',
        'locations',
        'timeline',
        'continuity'
      ] as const) {
        const hit = events.some(
          (e) =>
            e.phase === 'extracting' &&
            e.currentChapter === chapter &&
            e.currentPass === pass
        )
        expect(hit, `chapter ${chapter} / pass ${pass}`).toBe(true)
      }
    }

    const last = events[events.length - 1]!
    expect(last.phase).toBe('done')
    expect(last.tokensUsedSoFar).toBe(1200)
  })

  it('records one chapterContribution per successful chapter with chapterOrder and chapterUuid', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    const result = await runExtractionWithProvider(project, mock)

    expect(result.chapterContributions).toHaveLength(2)
    expect(result.chapterContributions[0]!.chapterOrder).toBe(1)
    expect(result.chapterContributions[0]!.chapterUuid).toBe('chapter-1')
    expect(result.chapterContributions[1]!.chapterOrder).toBe(2)
    expect(result.chapterContributions[1]!.chapterUuid).toBe('chapter-2')
  })

  it('populates chapterContribution deltas from the raw pass outputs', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    const result = await runExtractionWithProvider(project, mock)

    const contrib1 = result.chapterContributions[0]!
    expect(contrib1.characterDeltas).toEqual(OK_CHARACTERS.characters)
    expect(contrib1.locationDeltas).toEqual(OK_LOCATIONS.locations)
    expect(contrib1.timelineEvents).toEqual(OK_TIMELINE.events)
    expect(contrib1.continuityIssues).toEqual(OK_CONTINUITY.issues)
  })

  it('captures partial deltas when some passes fail but not all', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    mock.respond = (toolName, callIndex) => {
      if (toolName === 'record_locations' && callIndex === 0) {
        return new LLMProviderError('forced failure', 'parse')
      }
      return defaultRespond(toolName)
    }
    const result = await runExtractionWithProvider(project, mock)

    expect(result.chapterContributions).toHaveLength(2)
    const contrib1 = result.chapterContributions[0]!
    expect(contrib1.characterDeltas).toEqual(OK_CHARACTERS.characters)
    expect(contrib1.locationDeltas).toEqual([])
    expect(contrib1.timelineEvents).toEqual(OK_TIMELINE.events)
  })

  it('skips the chapterContribution entry when every pass fails for a chapter', async () => {
    const project = makeMiniProject()
    const mock = new MockProvider()
    mock.respond = (toolName, callIndex) => {
      if (callIndex === 0) {
        return new LLMProviderError(`forced ${toolName}`, 'parse')
      }
      return defaultRespond(toolName)
    }
    const result = await runExtractionWithProvider(project, mock)

    expect(result.chapterContributions).toHaveLength(1)
    expect(result.chapterContributions[0]!.chapterOrder).toBe(2)
  })

  it('dedupes character deltas by normalized name across scene-fallback calls', async () => {
    const bigChapter: ScrivenerChapter = {
      uuid: 'chapter-big',
      title: 'Big Chapter',
      order: 1,
      parentTitle: null,
      synopsis: null,
      label: null,
      status: null,
      scenes: [
        {
          uuid: 'scene-big-a',
          title: 'A',
          order: 1,
          content: 'x'.repeat((CHAPTER_TOKEN_SOFT_LIMIT + 1_000) * 4),
          wordCount: 0,
          contentHash: 'h-a',
          synopsis: null,
          label: null,
          status: null
        },
        {
          uuid: 'scene-big-b',
          title: 'B',
          order: 2,
          content: 'y',
          wordCount: 0,
          contentHash: 'h-b',
          synopsis: null,
          label: null,
          status: null
        }
      ]
    }
    const project: ScrivenerProject = {
      projectPath: '/tmp/big.scriv',
      projectName: 'big',
      parsedAt: '2026-04-16T00:00:00.000Z',
      warnings: [],
      chapters: [bigChapter]
    }
    const mock = new MockProvider()
    const result = await runExtractionWithProvider(project, mock)

    expect(result.chapterContributions).toHaveLength(1)
    const contrib = result.chapterContributions[0]!
    expect(contrib.characterDeltas).toHaveLength(1)
    expect(contrib.characterDeltas[0]!.name).toBe('Elara')
    expect(contrib.locationDeltas).toHaveLength(1)
    expect(contrib.timelineEvents.length).toBeGreaterThan(
      OK_TIMELINE.events.length
    )
    expect(result.warnings.some((w) => w.includes('per-scene fallback'))).toBe(
      true
    )
  })

  it('returns an empty chapterContributions array for a project with no chapters', async () => {
    const project: ScrivenerProject = {
      projectPath: '/tmp/empty.scriv',
      projectName: 'empty',
      parsedAt: '2026-04-16T00:00:00.000Z',
      warnings: [],
      chapters: []
    }
    const mock = new MockProvider()
    const result = await runExtractionWithProvider(project, mock)
    expect(result.chapterContributions).toEqual([])
  })
})
