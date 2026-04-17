import { describe, expect, it } from 'vitest'

import type { ScrivenerChapter } from '../../../shared/types'
import { hashChapter } from '../hashing'

function chapter(
  scenes: Array<{ uuid: string; contentHash: string }>
): ScrivenerChapter {
  return {
    uuid: 'ch-x',
    title: 'Chapter X',
    order: 1,
    parentTitle: null,
    synopsis: null,
    label: null,
    status: null,
    scenes: scenes.map((s, i) => ({
      uuid: s.uuid,
      title: `Scene ${s.uuid}`,
      order: i + 1,
      content: '',
      wordCount: 0,
      contentHash: s.contentHash,
      synopsis: null,
      label: null,
      status: null
    }))
  }
}

describe('hashChapter', () => {
  it('is deterministic: same input → same hash', () => {
    const a = chapter([
      { uuid: 'sc-1', contentHash: 'hash-1' },
      { uuid: 'sc-2', contentHash: 'hash-2' }
    ])
    const b = chapter([
      { uuid: 'sc-1', contentHash: 'hash-1' },
      { uuid: 'sc-2', contentHash: 'hash-2' }
    ])
    expect(hashChapter(a)).toBe(hashChapter(b))
  })

  it('changes when a scene contentHash changes', () => {
    const a = chapter([
      { uuid: 'sc-1', contentHash: 'hash-1' },
      { uuid: 'sc-2', contentHash: 'hash-2' }
    ])
    const b = chapter([
      { uuid: 'sc-1', contentHash: 'hash-1' },
      { uuid: 'sc-2', contentHash: 'hash-2-different' }
    ])
    expect(hashChapter(a)).not.toBe(hashChapter(b))
  })

  it('changes when scenes are reordered', () => {
    const a = chapter([
      { uuid: 'sc-1', contentHash: 'hash-1' },
      { uuid: 'sc-2', contentHash: 'hash-2' }
    ])
    const b = chapter([
      { uuid: 'sc-2', contentHash: 'hash-2' },
      { uuid: 'sc-1', contentHash: 'hash-1' }
    ])
    expect(hashChapter(a)).not.toBe(hashChapter(b))
  })

  it('ignores chapter title/metadata changes', () => {
    const a = chapter([{ uuid: 'sc-1', contentHash: 'hash-1' }])
    const b: ScrivenerChapter = {
      ...a,
      title: 'Completely Different Title',
      order: 42,
      synopsis: 'changed',
      label: 'important',
      status: 'draft'
    }
    expect(hashChapter(a)).toBe(hashChapter(b))
  })
})
