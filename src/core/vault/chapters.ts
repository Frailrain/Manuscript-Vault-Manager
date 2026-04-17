import { join } from 'node:path'

import type {
  ChapterExtraction,
  ExtractionResult,
  ScrivenerChapter,
  VaultProgress
} from '../../shared/types'
import { renderCallout } from './callouts'
import { buildFrontmatter } from './frontmatter'
import { stripHeadingMarkers } from './sanitize'
import { writeManagedFile } from './writeManaged'
import { renderEntityLink, type NameResolver } from './wikilinks'

export interface ChapterWriteContext {
  chaptersDir: string
  chapterFilenames: Map<number, string>
  chaptersByUuid: Map<string, ScrivenerChapter>
  characterResolver: NameResolver
  locationResolver: NameResolver
  characterFilenames: Map<string, string>
  locationFilenames: Map<string, string>
  warnings: string[]
  onProgress?: (progress: VaultProgress) => void
}

export interface ChapterWriteStats {
  filesWritten: number
  filesPreserved: number
}

export async function writeChapters(
  extraction: ExtractionResult,
  ctx: ChapterWriteContext
): Promise<ChapterWriteStats> {
  const stats: ChapterWriteStats = { filesWritten: 0, filesPreserved: 0 }
  const total = extraction.chapters.length
  for (let i = 0; i < extraction.chapters.length; i++) {
    const chapter = extraction.chapters[i]!
    const filename = ctx.chapterFilenames.get(chapter.chapterOrder)
    if (!filename) {
      throw new Error(
        `Internal error: no filename allocated for chapter order ${chapter.chapterOrder}`
      )
    }
    const path = join(ctx.chaptersDir, `${filename}.md`)
    ctx.onProgress?.({
      phase: 'chapters',
      current: i + 1,
      total,
      currentFile: `${filename}.md`
    })
    const content = buildChapterFile(chapter, extraction, ctx)
    const outcome = await writeManagedFile(path, content)
    stats.filesWritten += 1
    if (outcome.preserved) stats.filesPreserved += 1
  }
  return stats
}

function buildChapterFile(
  chapter: ChapterExtraction,
  extraction: ExtractionResult,
  ctx: ChapterWriteContext
): string {
  const scrivChapter = ctx.chaptersByUuid.get(chapter.chapterUuid)
  if (!scrivChapter) {
    ctx.warnings.push(
      `Chapter UUID '${chapter.chapterUuid}' (order ${chapter.chapterOrder}, title '${chapter.chapterTitle}') not found in Scrivener project; emitting file without parent/synopsis.`
    )
  }

  const frontmatter = buildFrontmatter({
    type: 'chapter',
    order: chapter.chapterOrder,
    title: chapter.chapterTitle,
    synopsis: scrivChapter?.synopsis ?? null,
    scrivenerUuid: chapter.chapterUuid,
    parent: scrivChapter?.parentTitle ?? null
  })

  const chapterCard = renderChapterCard(
    scrivChapter?.parentTitle ?? null,
    scrivChapter?.synopsis ?? null
  )

  const summaryBody = stripHeadingMarkers(
    chapter.summary || '*(not specified)*'
  )

  const events = extraction.timeline
    .filter((e) => e.chapterOrder === chapter.chapterOrder)
    .sort((a, b) => a.sequence - b.sequence)
  const eventsCallout =
    events.length > 0
      ? renderCallout({
          type: 'example',
          title: 'Events',
          body: events
            .map((e, idx) => `${idx + 1}. ${stripHeadingMarkers(e.summary)}`)
            .join('\n')
        })
      : null

  const charactersCallout =
    chapter.charactersAppearing.length > 0
      ? renderCallout({
          type: 'info',
          title: 'Characters',
          body: chapter.charactersAppearing
            .map((name) =>
              renderEntityLink(
                name,
                ctx.characterResolver,
                (canonical) =>
                  ctx.characterFilenames.get(canonical) ?? canonical,
                `chapter ${chapter.chapterOrder} characters`,
                ctx.warnings
              )
            )
            .join(' · ')
        })
      : null

  const locationsCallout =
    chapter.locationsAppearing.length > 0
      ? renderCallout({
          type: 'info',
          title: 'Locations',
          body: chapter.locationsAppearing
            .map((name) =>
              renderEntityLink(
                name,
                ctx.locationResolver,
                (canonical) =>
                  ctx.locationFilenames.get(canonical) ?? canonical,
                `chapter ${chapter.chapterOrder} locations`,
                ctx.warnings
              )
            )
            .join(' · ')
        })
      : null

  const lines: string[] = [frontmatter.trimEnd(), '']
  lines.push(`# Chapter ${chapter.chapterOrder}: ${chapter.chapterTitle}`, '')
  if (chapterCard) lines.push(chapterCard, '')
  lines.push('## Summary', '', summaryBody, '')
  if (eventsCallout) lines.push(eventsCallout, '')
  if (charactersCallout) lines.push(charactersCallout, '')
  if (locationsCallout) lines.push(locationsCallout, '')
  lines.push("## Writer's Notes", '')

  return lines.join('\n') + '\n'
}

function renderChapterCard(
  parent: string | null,
  synopsis: string | null
): string | null {
  const hasParent = parent !== null && parent.trim().length > 0
  const hasSynopsis = synopsis !== null && synopsis.trim().length > 0
  if (!hasParent && !hasSynopsis) return null
  const bodyLines: string[] = []
  if (hasParent) bodyLines.push(`**Part:** ${parent!.trim()}`)
  if (hasSynopsis) {
    bodyLines.push(
      `**Scrivener synopsis:** ${stripHeadingMarkers(synopsis!.trim())}`
    )
  }
  return renderCallout({
    type: 'abstract',
    title: 'Chapter Card',
    body: bodyLines.join('\n')
  })
}
