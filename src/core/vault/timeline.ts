import { join } from 'node:path'

import type { ExtractionResult, VaultProgress } from '../../shared/types'
import { writeFileAtomic } from './atomic'
import { buildFrontmatter } from './frontmatter'
import { sanitizeLLMText } from './sanitize'

const TIMELINE_FILENAME = 'Master Timeline.md'

export interface TimelineWriteContext {
  timelineDir: string
  onProgress?: (progress: VaultProgress) => void
}

export async function writeTimeline(
  extraction: ExtractionResult,
  ctx: TimelineWriteContext
): Promise<void> {
  ctx.onProgress?.({
    phase: 'timeline',
    current: 1,
    total: 1,
    currentFile: TIMELINE_FILENAME
  })
  const path = join(ctx.timelineDir, TIMELINE_FILENAME)
  await writeFileAtomic(path, buildTimelineFile(extraction))
}

function buildTimelineFile(extraction: ExtractionResult): string {
  const frontmatter = buildFrontmatter({
    type: 'timeline',
    eventCount: extraction.timeline.length
  })

  if (extraction.timeline.length === 0) {
    return (
      frontmatter +
      '# Master Timeline\n\nNo timeline events extracted.\n'
    )
  }

  const byChapter = new Map<number, typeof extraction.timeline>()
  for (const event of extraction.timeline) {
    const bucket = byChapter.get(event.chapterOrder) ?? []
    bucket.push(event)
    byChapter.set(event.chapterOrder, bucket)
  }

  const titlesByOrder = new Map<number, string>()
  for (const ch of extraction.chapters) {
    titlesByOrder.set(ch.chapterOrder, ch.chapterTitle)
  }

  const orderedChapterNumbers = Array.from(byChapter.keys()).sort(
    (a, b) => a - b
  )

  const sections: string[] = [
    '# Master Timeline',
    '',
    '<!-- This file is regenerated on every sync. Do not edit directly — add timeline notes to individual chapter files. -->',
    ''
  ]

  for (const chapterOrder of orderedChapterNumbers) {
    const title = titlesByOrder.get(chapterOrder) ?? '(untitled chapter)'
    sections.push(`## Chapter ${chapterOrder} — ${title}`, '')
    const events = byChapter
      .get(chapterOrder)!
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
    for (let i = 0; i < events.length; i++) {
      sections.push(`${i + 1}. ${sanitizeLLMText(events[i]!.summary)}`)
    }
    sections.push('')
  }

  return frontmatter + sections.join('\n').trimEnd() + '\n'
}
