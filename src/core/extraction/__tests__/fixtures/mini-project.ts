import type { ScrivenerProject } from '../../../../shared/types'

export function makeMiniProject(): ScrivenerProject {
  return {
    projectPath: '/tmp/mini.scriv',
    projectName: 'mini',
    parsedAt: '2026-04-16T00:00:00.000Z',
    warnings: [],
    chapters: [
      {
        uuid: 'chapter-1',
        title: 'Chapter 1',
        order: 1,
        parentTitle: null,
        synopsis: null,
        label: null,
        status: null,
        scenes: [
          {
            uuid: 'scene-1a',
            title: 'Scene 1a',
            order: 1,
            content:
              'Elara walked through the silver tower. She met the old scholar.',
            wordCount: 11,
            contentHash: 'hash-1a',
            synopsis: null,
            label: null,
            status: null
          }
        ]
      },
      {
        uuid: 'chapter-2',
        title: 'Chapter 2',
        order: 2,
        parentTitle: null,
        synopsis: null,
        label: null,
        status: null,
        scenes: [
          {
            uuid: 'scene-2a',
            title: 'Scene 2a',
            order: 1,
            content:
              'Elara returned to the tower. The scholar, whom some called The Keeper, revealed a secret.',
            wordCount: 15,
            contentHash: 'hash-2a',
            synopsis: null,
            label: null,
            status: null
          }
        ]
      }
    ]
  }
}
