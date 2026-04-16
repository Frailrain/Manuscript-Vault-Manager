import type {
  ExtractionResult,
  ScrivenerProject
} from '../../../../shared/types'

export function buildMiniScrivenerProject(): ScrivenerProject {
  return {
    projectPath: '/fixture/mini.scriv',
    projectName: 'Mini Test Novel',
    parsedAt: '2026-04-16T12:00:00.000Z',
    chapters: [
      {
        uuid: 'uuid-chapter-1',
        title: 'The Academy',
        order: 1,
        parentTitle: 'Part One',
        synopsis: 'Elara arrives.',
        label: null,
        status: null,
        scenes: []
      },
      {
        uuid: 'uuid-chapter-2',
        title: 'Redgate',
        order: 2,
        parentTitle: null,
        synopsis: null,
        label: null,
        status: null,
        scenes: []
      },
      {
        uuid: 'uuid-chapter-3',
        title: 'The Silver Tower',
        order: 3,
        parentTitle: null,
        synopsis: 'Elara meets the Archivist.',
        label: null,
        status: null,
        scenes: []
      }
    ],
    warnings: []
  }
}

export function buildMiniExtraction(): ExtractionResult {
  return {
    projectName: 'Mini Test Novel',
    generatedAt: '2026-04-16T12:05:00.000Z',
    chapters: [
      {
        chapterOrder: 1,
        chapterUuid: 'uuid-chapter-1',
        chapterTitle: 'The Academy',
        summary: 'Elara arrives at the academy and meets Vorn.',
        charactersAppearing: ['Elara', 'Captain Vorn'],
        locationsAppearing: ['The Academy']
      },
      {
        chapterOrder: 2,
        chapterUuid: 'uuid-chapter-2',
        chapterTitle: 'Redgate',
        summary: 'The city of Redgate falls to invaders.',
        charactersAppearing: ['Elara', 'Captain Vorn'],
        locationsAppearing: ['Redgate']
      },
      {
        chapterOrder: 3,
        chapterUuid: 'uuid-chapter-3',
        chapterTitle: 'The Silver Tower',
        summary: 'Elara reaches the Silver Tower and confronts the Archivist.',
        charactersAppearing: ['Elara', 'The Archivist'],
        locationsAppearing: ['The Silver Tower']
      }
    ],
    characters: [
      {
        name: 'Elara',
        aliases: ['El', 'The Scholar'],
        description:
          '(Ch 1): Tall, grey-eyed scholar with a scar across her cheek.\n\n(Ch 3): Carries a silver knife engraved with an unknown crest.',
        role: 'protagonist, first-year academy scholar',
        relationships: [
          { name: 'Captain Vorn', relationship: 'mentor, trained her at the academy' },
          { name: 'The Archivist', relationship: 'adversary, withholds information' }
        ],
        firstAppearanceChapter: 1,
        appearances: [1, 2, 3]
      },
      {
        name: 'Captain Vorn',
        aliases: [],
        description: 'A grizzled veteran of the Border Wars.',
        role: 'mentor',
        relationships: [
          { name: 'Elara', relationship: 'ward and protégée' }
        ],
        firstAppearanceChapter: 1,
        appearances: [1, 2]
      },
      {
        name: 'The Archivist',
        aliases: [],
        description: 'Shrouded in grey robes; face always hidden.',
        role: '',
        relationships: [],
        firstAppearanceChapter: 3,
        appearances: [3]
      }
    ],
    locations: [
      {
        name: 'The Academy',
        description: 'An ancient school of mages built from white granite.',
        significance: 'Where Elara is trained.',
        firstAppearanceChapter: 1,
        appearances: [1]
      },
      {
        name: 'The Silver Tower',
        description:
          '(Ch 3): A tall spire glinting in the afternoon sun.\n\n(Ch 3): Its upper floors hold forbidden books.',
        significance: 'Home of the Archivist and the banned texts.',
        firstAppearanceChapter: 3,
        appearances: [3]
      }
    ],
    timeline: [
      { chapterOrder: 1, summary: 'Elara arrives at the academy gates.', sequence: 1 },
      { chapterOrder: 1, summary: 'Vorn challenges her to a sparring match.', sequence: 2 },
      { chapterOrder: 2, summary: 'Invaders breach the Redgate wall.', sequence: 1 },
      { chapterOrder: 2, summary: 'Elara and Vorn flee north.', sequence: 2 },
      { chapterOrder: 3, summary: 'Elara ascends the Silver Tower alone.', sequence: 1 },
      { chapterOrder: 3, summary: 'The Archivist blocks her path to the archive.', sequence: 2 }
    ],
    continuityIssues: [
      {
        severity: 'high',
        description:
          "Elara's eye colour is described as grey in Chapter 1 and blue in Chapter 3.",
        chapters: [3],
        suggestion: 'Pick one eye colour and apply it consistently.'
      },
      {
        severity: 'medium',
        description: 'Vorn is described as left-handed in Ch 1 but sheathes on his left in Ch 2.',
        chapters: [2],
        suggestion: 'Clarify handedness or adjust the scabbard placement in Ch 2.'
      }
    ],
    tokenUsage: {
      inputTokens: 28_400,
      outputTokens: 4_180,
      estimatedCostUSD: 0.145
    },
    warnings: ['Fixture warning for tests'],
    chapterContributions: []
  }
}
