import type { ScrivenerChapter } from '../../shared/types'

// Anthropic's 200k-token context is plenty for most chapters, but we leave
// headroom for the system prompt, tool schema, accumulated prior context, and
// output. A ~60k-token chapter is already huge (≈45k words); splitting into
// per-scene calls is the escape hatch, not the common path.
export const CHAPTER_TOKEN_SOFT_LIMIT = 60_000

// Coarse heuristic: 4 chars ≈ 1 token. Fast, good enough for a gate check.
export function estimateChapterTokens(chapter: ScrivenerChapter): number {
  const totalChars = chapter.scenes.reduce(
    (n, scene) => n + scene.content.length,
    0
  )
  return Math.ceil(totalChars / 4)
}

export function chapterFitsInOneCall(chapter: ScrivenerChapter): boolean {
  return estimateChapterTokens(chapter) < CHAPTER_TOKEN_SOFT_LIMIT
}
