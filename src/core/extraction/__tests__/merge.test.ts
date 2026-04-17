import { describe, expect, it } from 'vitest'

import {
  mergeCharacters,
  mergeContinuity,
  mergeLocations,
  mergeTier,
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
        isNew: true,
        chapterActivity: '',
        tier: 'main'
      }
    ]
    const ch2: ExtractedCharacterDelta[] = [
      {
        name: 'Elara',
        aliases: [],
        description: 'A young mage.',
        role: 'protagonist',
        relationships: [],
        isNew: false,
        chapterActivity: '',
        tier: 'main'
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
          isNew: true,
          chapterActivity: '',
          tier: 'main'
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
          isNew: true,
          chapterActivity: '',
          tier: 'main'
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
      isNew: ch === 1,
      chapterActivity: '',
      tier: 'main'
    })
    mergeCharacters(running, [delta(1)], 1)
    mergeCharacters(running, [delta(2)], 2)

    expect(running[0]!.relationships).toHaveLength(1)
    expect(running[0]!.relationships[0]).toEqual({
      name: 'Marek',
      relationship: 'mentor'
    })
  })

  it('replaces relationship description when target name reappears with new wording', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: '',
          role: 'protagonist',
          relationships: [{ name: 'Marek', relationship: 'mentor' }],
          isNew: true,
          chapterActivity: '',
          tier: 'main'
        }
      ],
      1
    )
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: '',
          role: 'protagonist',
          relationships: [
            { name: 'Marek', relationship: 'trusted mentor and former captain' }
          ],
          isNew: false,
          chapterActivity: '',
          tier: 'main'
        }
      ],
      2
    )

    expect(running[0]!.relationships).toHaveLength(1)
    expect(running[0]!.relationships[0]).toEqual({
      name: 'Marek',
      relationship: 'trusted mentor and former captain'
    })
  })

  it('treats target name case-insensitively when deduping relationships', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: '',
          role: 'protagonist',
          relationships: [{ name: 'marek', relationship: 'mentor' }],
          isNew: true,
          chapterActivity: '',
          tier: 'main'
        }
      ],
      1
    )
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: '',
          role: 'protagonist',
          relationships: [{ name: 'Marek', relationship: 'sworn ally' }],
          isNew: false,
          chapterActivity: '',
          tier: 'main'
        }
      ],
      2
    )

    expect(running[0]!.relationships).toHaveLength(1)
    expect(running[0]!.relationships[0]).toEqual({
      name: 'Marek',
      relationship: 'sworn ally'
    })
  })

  it('keeps relationships to different target names as separate entries', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: '',
          role: 'protagonist',
          relationships: [
            { name: 'Marek', relationship: 'mentor' },
            { name: 'Lirien', relationship: 'rival' }
          ],
          isNew: true,
          chapterActivity: '',
          tier: 'main'
        }
      ],
      1
    )

    expect(running[0]!.relationships).toHaveLength(2)
    expect(running[0]!.relationships.map((r) => r.name).sort()).toEqual([
      'Lirien',
      'Marek'
    ])
  })

  it('promotes a character when a later chapter classifies them at a higher tier', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Vorn',
          aliases: [],
          description: '',
          role: 'guard',
          relationships: [],
          isNew: true,
          chapterActivity: '',
          tier: 'minor'
        }
      ],
      1
    )
    mergeCharacters(
      running,
      [
        {
          name: 'Vorn',
          aliases: [],
          description: '',
          role: 'mentor',
          relationships: [],
          isNew: false,
          chapterActivity: '',
          tier: 'main'
        }
      ],
      2
    )

    expect(running[0]!.tier).toBe('main')
  })

  it('does not demote a character when a later chapter classifies them lower', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: '',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          chapterActivity: '',
          tier: 'main'
        }
      ],
      1
    )
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: '',
          role: 'protagonist',
          relationships: [],
          isNew: false,
          chapterActivity: '',
          tier: 'minor'
        }
      ],
      2
    )

    expect(running[0]!.tier).toBe('main')
  })

  it('stores chapterActivity under the current chapter order for a new character', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          chapterActivity: 'Enters the tower. Confronts the scholar.',
          tier: 'main'
        }
      ],
      3
    )
    expect(running[0]!.chapterActivity).toEqual({
      3: 'Enters the tower. Confronts the scholar.'
    })
  })

  it('accumulates chapterActivity entries across chapters for the same character', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          chapterActivity: 'Arrives at the gates.',
          tier: 'main'
        }
      ],
      1
    )
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: false,
          chapterActivity: 'Ascends the tower.',
          tier: 'main'
        }
      ],
      2
    )
    expect(running[0]!.chapterActivity).toEqual({
      1: 'Arrives at the gates.',
      2: 'Ascends the tower.'
    })
  })

  it('skips empty/whitespace chapterActivity values', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          chapterActivity: '   ',
          tier: 'main'
        }
      ],
      1
    )
    expect(running[0]!.chapterActivity).toEqual({})
  })

  it('overwrites chapterActivity when the same chapter is merged twice', () => {
    const running: ExtractedCharacter[] = []
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: true,
          chapterActivity: 'First draft of activity.',
          tier: 'main'
        }
      ],
      1
    )
    mergeCharacters(
      running,
      [
        {
          name: 'Elara',
          aliases: [],
          description: 'A young mage.',
          role: 'protagonist',
          relationships: [],
          isNew: false,
          chapterActivity: 'Second draft of activity.',
          tier: 'main'
        }
      ],
      1
    )
    expect(running[0]!.chapterActivity).toEqual({
      1: 'Second draft of activity.'
    })
  })
})

describe('mergeTier', () => {
  it('returns the higher rank when incoming exceeds existing', () => {
    expect(mergeTier('minor', 'secondary')).toBe('secondary')
    expect(mergeTier('secondary', 'main')).toBe('main')
    expect(mergeTier('minor', 'main')).toBe('main')
  })

  it('keeps the existing tier when incoming is lower or equal', () => {
    expect(mergeTier('main', 'secondary')).toBe('main')
    expect(mergeTier('secondary', 'minor')).toBe('secondary')
    expect(mergeTier('main', 'main')).toBe('main')
  })
})

describe('mergeLocations', () => {
  it('preserves parentLocation when later chapters provide null', () => {
    const running: ExtractedLocation[] = []
    mergeLocations(
      running,
      [
        {
          name: 'Throne Room',
          description: 'Vaulted hall.',
          significance: '',
          isNew: true,
          parentLocation: 'Iron Palace'
        }
      ],
      1
    )
    mergeLocations(
      running,
      [
        {
          name: 'Throne Room',
          description: 'Vaulted hall.',
          significance: '',
          isNew: false,
          parentLocation: null
        }
      ],
      2
    )
    expect(running[0]!.parentLocation).toBe('Iron Palace')
  })

  it('refines parentLocation when a later chapter provides a more specific parent', () => {
    const running: ExtractedLocation[] = []
    mergeLocations(
      running,
      [
        {
          name: 'Defensive Line',
          description: 'A row of trenches.',
          significance: '',
          isNew: true,
          parentLocation: null
        }
      ],
      1
    )
    mergeLocations(
      running,
      [
        {
          name: 'Defensive Line',
          description: 'A row of trenches.',
          significance: '',
          isNew: false,
          parentLocation: "Ganston's Crossing"
        }
      ],
      2
    )
    expect(running[0]!.parentLocation).toBe("Ganston's Crossing")
  })

  it('appends differing descriptions with chapter tags when the same location appears twice', () => {
    const running: ExtractedLocation[] = []
    const ch1: ExtractedLocationDelta[] = [
      {
        name: 'The Silver Tower',
        description: 'A tall spire glinting in the sun.',
        significance: 'Home of the scholars.',
        isNew: true,
        parentLocation: null
      }
    ]
    const ch2: ExtractedLocationDelta[] = [
      {
        name: 'The Silver Tower',
        description: 'Its upper floors hold forbidden books.',
        significance: '',
        isNew: false,
        parentLocation: null
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
