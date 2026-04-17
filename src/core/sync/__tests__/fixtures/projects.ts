import type {
  ScrivenerChapter,
  ScrivenerProject,
  ScrivenerScene
} from '../../../../shared/types'

function scene(
  uuid: string,
  order: number,
  content: string,
  contentHash: string
): ScrivenerScene {
  return {
    uuid,
    title: `Scene ${uuid}`,
    order,
    content,
    wordCount: content.split(/\s+/).length,
    contentHash,
    synopsis: null,
    label: null,
    status: null
  }
}

function chapter(
  uuid: string,
  order: number,
  title: string,
  scenes: ScrivenerScene[]
): ScrivenerChapter {
  return {
    uuid,
    title,
    order,
    parentTitle: null,
    synopsis: null,
    label: null,
    status: null,
    scenes
  }
}

function wrap(chapters: ScrivenerChapter[]): ScrivenerProject {
  return {
    projectPath: '/tmp/test.scriv',
    projectName: 'test',
    parsedAt: '2026-04-16T00:00:00.000Z',
    warnings: [],
    chapters
  }
}

export function buildProjectV1(): ScrivenerProject {
  return wrap([
    chapter('ch-1', 1, 'Chapter 1', [
      scene('sc-1a', 1, 'Elara walked into the Silver Tower.', 'hash-1a')
    ]),
    chapter('ch-2', 2, 'Chapter 2', [
      scene('sc-2a', 1, 'Elara met the scholar there.', 'hash-2a')
    ]),
    chapter('ch-3', 3, 'Chapter 3', [
      scene('sc-3a', 1, 'Elara discovered the ancient book.', 'hash-3a')
    ])
  ])
}

/** Chapter 2's scene content changes (new hash). */
export function buildProjectV2_ch2Modified(): ScrivenerProject {
  return wrap([
    chapter('ch-1', 1, 'Chapter 1', [
      scene('sc-1a', 1, 'Elara walked into the Silver Tower.', 'hash-1a')
    ]),
    chapter('ch-2', 2, 'Chapter 2', [
      scene(
        'sc-2a',
        1,
        'Elara met the scholar there, and they argued about the book.',
        'hash-2a-v2'
      )
    ]),
    chapter('ch-3', 3, 'Chapter 3', [
      scene('sc-3a', 1, 'Elara discovered the ancient book.', 'hash-3a')
    ])
  ])
}

/** New ch-2b inserted between ch-2 and ch-3, pushing ch-3 to order 4. */
export function buildProjectV3_insertedCh2b(): ScrivenerProject {
  return wrap([
    chapter('ch-1', 1, 'Chapter 1', [
      scene('sc-1a', 1, 'Elara walked into the Silver Tower.', 'hash-1a')
    ]),
    chapter('ch-2', 2, 'Chapter 2', [
      scene('sc-2a', 1, 'Elara met the scholar there.', 'hash-2a')
    ]),
    chapter('ch-2b', 3, 'Chapter 2b', [
      scene('sc-2ba', 1, 'They walked together through the garden.', 'hash-2ba')
    ]),
    chapter('ch-3', 4, 'Chapter 3', [
      scene('sc-3a', 1, 'Elara discovered the ancient book.', 'hash-3a')
    ])
  ])
}

/** ch-3 removed from the project. */
export function buildProjectV4_removedCh3(): ScrivenerProject {
  return wrap([
    chapter('ch-1', 1, 'Chapter 1', [
      scene('sc-1a', 1, 'Elara walked into the Silver Tower.', 'hash-1a')
    ]),
    chapter('ch-2', 2, 'Chapter 2', [
      scene('sc-2a', 1, 'Elara met the scholar there.', 'hash-2a')
    ])
  ])
}

/** Only the chapter order changes: ch-2 becomes ch-3 and vice versa. Content hashes intact. */
export function buildProjectV5_reorderedCh2Ch3(): ScrivenerProject {
  return wrap([
    chapter('ch-1', 1, 'Chapter 1', [
      scene('sc-1a', 1, 'Elara walked into the Silver Tower.', 'hash-1a')
    ]),
    chapter('ch-3', 2, 'Chapter 3', [
      scene('sc-3a', 1, 'Elara discovered the ancient book.', 'hash-3a')
    ]),
    chapter('ch-2', 3, 'Chapter 2', [
      scene('sc-2a', 1, 'Elara met the scholar there.', 'hash-2a')
    ])
  ])
}
