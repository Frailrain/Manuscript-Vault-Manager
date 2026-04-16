import { describe, expect, it } from 'vitest'

import {
  CHAPTER_TOKEN_SOFT_LIMIT,
  chapterFitsInOneCall,
  estimateChapterTokens
} from '../chunking'
import type { ScrivenerChapter, ScrivenerScene } from '../../../shared/types'

function makeChapter(sceneContents: string[]): ScrivenerChapter {
  const scenes: ScrivenerScene[] = sceneContents.map((content, i) => ({
    uuid: `s${i}`,
    title: `Scene ${i + 1}`,
    order: i + 1,
    content,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    contentHash: 'h',
    synopsis: null,
    label: null,
    status: null
  }))
  return {
    uuid: 'ch',
    title: 'Chapter',
    order: 1,
    parentTitle: null,
    scenes,
    synopsis: null,
    label: null,
    status: null
  }
}

describe('chunking', () => {
  it('small chapter fits in one call', () => {
    const chapter = makeChapter(['Short text.', 'Another short scene.'])
    expect(chapterFitsInOneCall(chapter)).toBe(true)
    expect(estimateChapterTokens(chapter)).toBeLessThan(CHAPTER_TOKEN_SOFT_LIMIT)
  })

  it('a 300k-character chapter triggers the per-scene fallback', () => {
    const block = 'x'.repeat(150_000)
    const chapter = makeChapter([block, block])
    expect(chapterFitsInOneCall(chapter)).toBe(false)
    expect(estimateChapterTokens(chapter)).toBeGreaterThanOrEqual(
      CHAPTER_TOKEN_SOFT_LIMIT
    )
  })
})
