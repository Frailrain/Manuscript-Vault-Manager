import { describe, expect, it } from 'vitest'

import type {
  ChapterContribution,
  ChapterExtraction,
  ExtractedCharacterDelta,
  ExtractedLocationDelta
} from '../../../shared/types'
import { rebuildMergedState } from '../rebuild'
import {
  buildProjectV1,
  buildProjectV3_insertedCh2b,
  buildProjectV5_reorderedCh2Ch3
} from './fixtures/projects'

function emptyContribution(
  chapterUuid: string,
  chapterOrder: number
): ChapterContribution {
  return {
    chapterOrder,
    chapterUuid,
    characterDeltas: [],
    locationDeltas: [],
    timelineEvents: [],
    continuityIssues: []
  }
}

describe('rebuildMergedState', () => {
  it('renumbers chapter orders from the current project (not from stored contribution)', () => {
    // Simulate: in the stored contribution, ch-2 was at order 2. After reorder
    // (buildProjectV5), ch-2 is at order 3 — the timeline should reflect 3.
    const contributions: ChapterContribution[] = [
      {
        ...emptyContribution('ch-1', 1),
        timelineEvents: [{ summary: 'ch-1 event', sequence: 1 }]
      },
      {
        ...emptyContribution('ch-2', 2),
        timelineEvents: [{ summary: 'ch-2 event', sequence: 1 }]
      },
      {
        ...emptyContribution('ch-3', 3),
        timelineEvents: [{ summary: 'ch-3 event', sequence: 1 }]
      }
    ]
    const extractions: ChapterExtraction[] = [
      {
        chapterOrder: 1,
        chapterUuid: 'ch-1',
        chapterTitle: 'Chapter 1',
        summary: '',
        charactersAppearing: [],
        locationsAppearing: []
      },
      {
        chapterOrder: 2,
        chapterUuid: 'ch-2',
        chapterTitle: 'Chapter 2',
        summary: '',
        charactersAppearing: [],
        locationsAppearing: []
      },
      {
        chapterOrder: 3,
        chapterUuid: 'ch-3',
        chapterTitle: 'Chapter 3',
        summary: '',
        charactersAppearing: [],
        locationsAppearing: []
      }
    ]
    const v5 = buildProjectV5_reorderedCh2Ch3() // ch-1, ch-3, ch-2
    const rebuilt = rebuildMergedState(contributions, extractions, v5.chapters)

    const evByUuid = new Map(
      rebuilt.chapters.map((c) => [c.chapterUuid, c.chapterOrder])
    )
    expect(evByUuid.get('ch-2')).toBe(3)
    expect(evByUuid.get('ch-3')).toBe(2)

    // Timeline events reflect current orders.
    const timelineByCh = new Map(
      rebuilt.timeline.map((t) => [t.summary, t.chapterOrder])
    )
    expect(timelineByCh.get('ch-2 event')).toBe(3)
    expect(timelineByCh.get('ch-3 event')).toBe(2)
    // Sorted by chapterOrder, then sequence.
    expect(rebuilt.timeline.map((t) => t.chapterOrder)).toEqual([1, 2, 3])
  })

  it('drops contributions whose UUIDs are no longer in the project, with a warning', () => {
    const contributions: ChapterContribution[] = [
      emptyContribution('ch-1', 1),
      emptyContribution('ch-2', 2),
      emptyContribution('ch-gone', 99)
    ]
    const v1 = buildProjectV1()
    const rebuilt = rebuildMergedState(contributions, [], v1.chapters)

    expect(rebuilt.chapters.map((c) => c.chapterUuid)).toEqual([
      'ch-1',
      'ch-2'
    ])
    expect(rebuilt.warnings.some((w) => w.includes('ch-gone'))).toBe(true)
  })

  it('sorts aligned contributions by current order when chapters were inserted', () => {
    // Store pre-insert contributions with old orders 1,2,3 for ch-1/ch-2/ch-3.
    // Current project is v3: ch-1=1, ch-2=2, ch-2b=3, ch-3=4.
    const contributions: ChapterContribution[] = [
      {
        ...emptyContribution('ch-3', 3),
        timelineEvents: [{ summary: 'ch-3', sequence: 1 }]
      },
      {
        ...emptyContribution('ch-1', 1),
        timelineEvents: [{ summary: 'ch-1', sequence: 1 }]
      },
      {
        ...emptyContribution('ch-2', 2),
        timelineEvents: [{ summary: 'ch-2', sequence: 1 }]
      }
    ]
    const v3 = buildProjectV3_insertedCh2b()
    const rebuilt = rebuildMergedState(contributions, [], v3.chapters)

    // ch-2b has no contribution → not in rebuilt.chapters, but also no warning.
    expect(rebuilt.chapters.map((c) => c.chapterUuid)).toEqual([
      'ch-1',
      'ch-2',
      'ch-3'
    ])
    expect(rebuilt.chapters.map((c) => c.chapterOrder)).toEqual([1, 2, 4])
    expect(rebuilt.timeline.map((t) => t.chapterOrder)).toEqual([1, 2, 4])
  })

  it('merges character deltas with appearances reflecting current chapter orders', () => {
    const contributions: ChapterContribution[] = [
      {
        ...emptyContribution('ch-1', 1),
        characterDeltas: [
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
      },
      {
        ...emptyContribution('ch-2', 2),
        characterDeltas: [
          {
            name: 'Elara',
            aliases: [],
            description: 'A young mage.',
            role: 'protagonist',
            relationships: [],
            isNew: false,
            tier: 'main'
          }
        ]
      }
    ]
    const v5 = buildProjectV5_reorderedCh2Ch3() // ch-2 now at order 3
    const rebuilt = rebuildMergedState(contributions, [], v5.chapters)

    expect(rebuilt.characters).toHaveLength(1)
    const elara = rebuilt.characters[0]!
    expect(elara.name).toBe('Elara')
    expect(elara.appearances).toEqual([1, 3])
    expect(elara.firstAppearanceChapter).toBe(1)
  })

  it("defaults a stored character delta missing 'tier' to 'minor' on rebuild", () => {
    // Simulates a contribution persisted before tier was added to the schema.
    const legacyCharacterDelta = {
      name: 'Elara',
      aliases: [],
      description: 'A young mage.',
      role: 'protagonist',
      relationships: [],
      isNew: true
    } as unknown as ExtractedCharacterDelta
    const contributions: ChapterContribution[] = [
      {
        ...emptyContribution('ch-1', 1),
        characterDeltas: [legacyCharacterDelta]
      }
    ]
    const v1 = buildProjectV1()
    const rebuilt = rebuildMergedState(contributions, [], v1.chapters)

    expect(rebuilt.characters).toHaveLength(1)
    expect(rebuilt.characters[0]!.tier).toBe('minor')
  })

  it("defaults a stored location delta missing 'parentLocation' to null on rebuild", () => {
    // Simulates a contribution persisted before parentLocation was added.
    const legacyLocationDelta = {
      name: 'The Tower',
      description: 'Tall.',
      significance: '',
      isNew: true
    } as unknown as ExtractedLocationDelta
    const contributions: ChapterContribution[] = [
      {
        ...emptyContribution('ch-1', 1),
        locationDeltas: [legacyLocationDelta]
      }
    ]
    const v1 = buildProjectV1()
    const rebuilt = rebuildMergedState(contributions, [], v1.chapters)

    expect(rebuilt.locations).toHaveLength(1)
    expect(rebuilt.locations[0]!.parentLocation).toBeNull()
  })
})
