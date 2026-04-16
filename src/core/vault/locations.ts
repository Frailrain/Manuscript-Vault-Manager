import { join } from 'node:path'

import type {
  ExtractedLocation,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { buildFrontmatter } from './frontmatter'
import { managedBlock } from './managed'
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

  const descriptionBlock = managedBlock(
    location.description.trim().length > 0
      ? location.description
      : '*(not specified)*'
  )

  const significanceBlock = managedBlock(
    location.significance.trim().length > 0
      ? location.significance
      : '*(not specified)*'
  )

  const appearancesBody =
    location.appearances.length > 0
      ? location.appearances
          .map((order) => `- ${chapterWikiLink(order, ctx.chapterFilenames)}`)
          .join('\n')
      : '*(none)*'
  const appearancesBlock = managedBlock(appearancesBody)

  const lines: string[] = [
    frontmatter.trimEnd(),
    '',
    `# ${location.name}`,
    '',
    '## Description',
    '',
    descriptionBlock,
    '',
    '## Significance',
    '',
    significanceBlock,
    '',
    '## Appearances',
    '',
    appearancesBlock,
    '',
    "## Writer's Notes",
    ''
  ]

  return lines.join('\n') + '\n'
}
