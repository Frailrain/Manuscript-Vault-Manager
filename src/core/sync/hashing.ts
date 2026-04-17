import { createHash } from 'node:crypto'

import type { ScrivenerChapter } from '../../shared/types'

/**
 * Combine a chapter's ordered (sceneUuid, contentHash) pairs into a single
 * chapter-level hash. Scene UUIDs are folded in so that swapping two scenes'
 * contents (same hashes, different positions) registers as a change, and so
 * that adding/removing an empty-content scene is still visible.
 *
 * Chapter-level metadata like title is deliberately excluded — a rename is
 * not a content change.
 */
export function hashChapter(chapter: ScrivenerChapter): string {
  const h = createHash('sha256')
  for (const scene of chapter.scenes) {
    h.update(scene.uuid)
    h.update('\x00')
    h.update(scene.contentHash)
    h.update('\x00')
  }
  return h.digest('hex')
}
