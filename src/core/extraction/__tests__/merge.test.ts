import { describe, expect, it } from 'vitest'

import {
  mergeCharacters,
  mergeContinuity,
  mergeLocations,
  mergeTimeline,
  sortTimeline
} from '../merge'
import type {
  ContinuityIssue,
  ExtractedCharacter,
  ExtractedLocation,
  TimelineEvent
} from '../../../shared/types'
import type { ExtractedCharacterDelta, ExtractedLocationDelta } from '../passes'

describe('mergeCharacters', () => {
  it('carries the same character across two chapters with a single entry', () => {
    const running: ExtractedCharacter[] = []
    const ch1: ExtractedCharacterDelta[] = [
      {
        name: 'Elara',
        aliases: [],
        description: 'A young mage.',
        role: 'protagonist',
        relationships: [],
        isNew: true
      }
    ]
    const ch2: ExtractedCharacterDelta[] = [
      {
        name: 'Elara',
        aliases: [],
        description: 'A young mage.',
        role: 'protagonist',
        relationships: [],
        isNew: false
      }
    ]
    mergeCharacters(running, ch1, 1)
    mergeCharacters(running, ch2, 2)

    expect(running).toHaveLength(1)
    expect(running[0]!.appearances).toEqual([1, 2])
    expect(running[0]!.firstAppearanceChapter).toBe(1)
  })

  it('folds an alias-matched entry into the canonical one', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: 'Young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true
        }
      ],
      1
    )
    mergeCharacters(
      running,
      [
        {
          name: 'The Scholar',
          aliases: ['Elara'],
          description: 'Robed and bookish.',
          role: 'scholar',
          relationships: [],
          isNew: true
        }
      ],
      2
    )

    expect(running).toHaveLength(1)
    const only = running[0]!
    expect(only.name).toBe('Elara')
    expect(only.aliases).toContain('The Scholar')
    expect(only.appearances).toEqual([1, 2])
    expect(only.description).toContain('Young mage.')
    expect(only.description).toContain('Robed and bookish.')
  })

  it('deduplicates identical {name, relationship} pairs across chapters', () => {
    const running: ExtractedCharacter[] = []
    const delta = (ch: number): ExtractedCharacterDelta => ({
      name: 'Elara',
      aliases: [],
      description: '',
      role: 'protagonist',
      relationships: [{ name: 'Marek', relationship: 'mentor' }],
      isNew: ch === 1
    })
    mergeCharacters(running, [delta(1)], 1)
    mergeCharacters(running, [delta(2)], 2)

    expect(running[0]!.relationships).toHaveLength(1)
    expect(running[0]!.relationships[0]).toEqual({
      name: 'Marek',
      relationship: 'mentor'
    })
  })
})

describe('mergeLocations', () => {
  it('appends differing descriptions with chapter tags when the same location appears twice', () => {
    const running: ExtractedLocation[] = []
    const ch1: ExtractedLocationDelta[] = [
      {
        name: 'The Silver Tower',
        description: 'A tall spire glinting in the sun.',
        significance: 'Home of the scholars.',
        isNew: true
      }
    ]
    const ch2: ExtractedLocationDelta[] = [
      {
        name: 'The Silver Tower',
        description: 'Its upper floors hold forbidden books.',
        significance: '',
        isNew: false
      }
    ]
    mergeLocations(running, ch1, 1)
    mergeLocations(running, ch2, 2)

    expect(running).toHaveLength(1)
    const loc = running[0]!
    expect(loc.appearances).toEqual([1, 2])
    expect(loc.description).toContain('A tall spire glinting in the sun.')
    expect(loc.description).toContain('Its upper floors hold forbidden books.')
    expect(loc.description).toContain('(Ch 2)')
  })
})

describe('mergeTimeline', () => {
  it('appends events and sorts them by chapterOrder then sequence', () => {
    const running: TimelineEvent[] = []
    mergeTimeline(
      running,
      [
        { summary: 'Second event', sequence: 2 },
        { summary: 'First event', sequence: 1 }
      ],
      2
    )
    mergeTimeline(running, [{ summary: 'Opening', sequence: 1 }], 1)
    const sorted = sortTimeline(running)
    expect(sorted.map((e) => e.summary)).toEqual([
      'Opening',
      'First event',
      'Second event'
    ])
  })
})

describe('mergeContinuity', () => {
  it('keeps per-chapter continuity issues as individual records', () => {
    const running: ContinuityIssue[] = []
    mergeContinuity(
      running,
      [
        {
          severity: 'high',
          description: 'Eye colour changed.',
          suggestion: 'Pick one.',
          relatedCharacters: ['Elara']
        }
      ],
      2
    )
    expect(running).toHaveLength(1)
    expect(running[0]!.chapters).toEqual([2])
  })
})
