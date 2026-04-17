import { join } from 'node:path'

import type {
  ExtractedLocation,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { renderCallout } from './callouts'
import {
  parseChapterTaggedDescription,
  synthesizeDescription
} from './descriptions'
import { buildFrontmatter } from './frontmatter'
import { stripHeadingMarkers } from './sanitize'
import { writeManagedFile } from './writeManaged'
import { chapterWikiLink } from './wikilinks'

export interface LocationWriteContext {
  locationsDir: string
  locationFilenames: Map<string, string>
  chapterFilenames: Map<number, string>
  warnings: string[]
  onProgress?: (progress: VaultProgress) => void
}

export interface LocationWriteStats {
  filesWritten: number
  filesPreserved: number
}

export async function writeLocations(
  extraction: ExtractionResult,
  ctx: LocationWriteContext
): Promise<LocationWriteStats> {
  const stats: LocationWriteStats = { filesWritten: 0, filesPreserved: 0 }
  const total = extraction.locations.length
  for (let i = 0; i < extraction.locations.length; i++) {
    const location = extraction.locations[i]!
    const filename = ctx.locationFilenames.get(location.name)
    if (!filename) {
      throw new Error(
        `Internal error: no filename allocated for location '${location.name}'`
      )
    }
    const path = join(ctx.locationsDir, `${filename}.md`)
    ctx.onProgress?.({
      phase: 'locations',
      current: i + 1,
      total,
      currentFile: `${filename}.md`
    })
    const content = buildLocationFile(location, ctx)
    const outcome = await writeManagedFile(path, content)
    stats.filesWritten += 1
    if (outcome.preserved) stats.filesPreserved += 1
  }
  return stats
}

function buildLocationFile(
  location: ExtractedLocation,
  ctx: LocationWriteContext
): string {
  const frontmatter = buildFrontmatter({
    type: 'location',
    name: location.name,
    firstAppearance: location.firstAppearanceChapter,
    appearances: [...location.appearances]
  })

  const atAGlance = renderAtAGlance(location)
  const descriptionSection = renderDescriptionSection(location.description)
  const appearancesSection = renderAppearancesSection(location, ctx)

  const lines: string[] = [
    frontmatter.trimEnd(),
    '',
    `# ${location.name}`,
    '',
    atAGlance,
    '',
    '## Description',
    '',
    descriptionSection,
    '',
    '## Appearances',
    '',
    appearancesSection,
    '',
    "## Writer's Notes",
    ''
  ]

  return lines.join('\n') + '\n'
}

function renderAtAGlance(location: ExtractedLocation): string {
  const bodyLines: string[] = []
  bodyLines.push(`**First seen:** Chapter ${location.firstAppearanceChapter}`)
  const appearsCount = location.appearances.length
  bodyLines.push(
    `**Appears in:** ${appearsCount} ${appearsCount === 1 ? 'chapter' : 'chapters'}`
  )
  const significance = location.significance.trim()
  if (significance.length > 0) {
    bodyLines.push(`**Significance:** ${stripHeadingMarkers(significance)}`)
  }
  return renderCallout({
    type: 'abstract',
    title: 'At a Glance',
    body: bodyLines.join('\n')
  })
}

function renderDescriptionSection(rawDescription: string): string {
  const trimmed = rawDescription.trim()
  if (trimmed.length === 0) {
    return '*(not specified)*'
  }

  const blocks = parseChapterTaggedDescription(trimmed)
  const synthesized = stripHeadingMarkers(
    synthesizeDescription(trimmed, '. It ')
  )

  if (blocks.length < 2) {
    return synthesized
  }

  const perChapterBody = blocks
    .map(
      (b) => `**Chapter ${b.chapterOrder}:** ${stripHeadingMarkers(b.text)}`
    )
    .join('\n')
  const perChapterCallout = renderCallout({
    type: 'note',
    title: 'Per-chapter detail',
    body: perChapterBody,
    foldable: true
  })

  return `${synthesized}\n\n${perChapterCallout}`
}

function renderAppearancesSection(
  location: ExtractedLocation,
  ctx: LocationWriteContext
): string {
  if (location.appearances.length === 0) return '*(none)*'
  return location.appearances
    .map((order) => `- ${chapterWikiLink(order, ctx.chapterFilenames)}`)
    .join('\n')
}
