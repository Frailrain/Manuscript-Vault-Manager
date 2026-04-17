import { mkdir, readdir, rm, unlink } from 'node:fs/promises'
import { join } from 'node:path'

import type {
  ExtractionResult,
  ScrivenerChapter,
  ScrivenerProject,
  VaultGenerationResult,
  VaultGeneratorOptions,
  VaultProgress
} from '../../shared/types'
import { writeFileAtomic } from './atomic'
import { writeChapters } from './chapters'
import { writeCharacters } from './characters'
import { writeContinuity } from './continuity'
import { writeDashboard } from './dashboard'
import { VaultGenerationError } from './errors'
import {
  CHARACTER_TIER_FOLDERS,
  allocateCharacterFilenames,
  chapterFilename as buildChapterFilename
} from './filenames'
import { allocateLocationFilenames, writeLocations } from './locations'
import { writeTimeline } from './timeline'
import { buildNameResolver } from './wikilinks'

export async function generateVault(
  extraction: ExtractionResult,
  scrivenerProject: ScrivenerProject,
  vaultPath: string,
  options: VaultGeneratorOptions
): Promise<VaultGenerationResult> {
  const startTime = Date.now()
  validateInputs(extraction, scrivenerProject, vaultPath, options)

  const onProgress: ((p: VaultProgress) => void) | undefined = options.onProgress

  try {
    await ensureDirectory(vaultPath)

    const chaptersDir = join(vaultPath, 'Chapters')
    const charactersDir = join(vaultPath, 'Characters')
    const locationsDir = join(vaultPath, 'Locations')
    const timelineDir = join(vaultPath, 'Timeline')
    const continuityDir = join(vaultPath, 'Continuity')
    const metaDir = join(vaultPath, '_meta')

    if (options.clean) {
      await rm(chaptersDir, { recursive: true, force: true })
      await rm(charactersDir, { recursive: true, force: true })
      await rm(locationsDir, { recursive: true, force: true })
    }

    for (const dir of [
      chaptersDir,
      charactersDir,
      locationsDir,
      timelineDir,
      continuityDir,
      metaDir
    ]) {
      await ensureDirectory(dir)
    }

    for (const folder of CHARACTER_TIER_FOLDERS) {
      await ensureDirectory(join(charactersDir, folder))
    }

    const warnings: string[] = []
    await cleanupLegacyFlatCharacters(charactersDir, warnings)

    const { chapterFilenames, chaptersByUuid } = buildChapterIndexes(
      extraction,
      scrivenerProject,
      warnings
    )

    const characterAllocation = allocateCharacterFilenames(
      extraction.characters
    )
    const characterFilenames = characterAllocation.filenames
    warnings.push(...characterAllocation.warnings)

    const locationAllocation = allocateLocationFilenames(extraction.locations)
    const locationFilenames = locationAllocation.filenames
    const locationChildren = locationAllocation.children
    warnings.push(...locationAllocation.warnings)

    const characterResolver = buildNameResolver(extraction.characters)
    const locationResolver = buildNameResolver(extraction.locations)

    let filesWritten = 0
    let filesPreserved = 0

    const chapterStats = await writeChapters(extraction, {
      chaptersDir,
      chapterFilenames,
      chaptersByUuid,
      characterResolver,
      locationResolver,
      characterFilenames,
      locationFilenames,
      warnings,
      onProgress
    })
    filesWritten += chapterStats.filesWritten
    filesPreserved += chapterStats.filesPreserved

    const characterStats = await writeCharacters(extraction, {
      charactersDir,
      characterFilenames,
      characterResolver,
      chapterFilenames,
      warnings,
      onProgress,
      characterFields: options.characterFields,
      characterSectionLabel: options.characterSectionLabel
    })
    filesWritten += characterStats.filesWritten
    filesPreserved += characterStats.filesPreserved

    const locationStats = await writeLocations(extraction, {
      locationsDir,
      locationFilenames,
      locationChildren,
      chapterFilenames,
      warnings,
      onProgress,
      locationFields: options.locationFields,
      locationSectionLabel: options.locationSectionLabel
    })
    filesWritten += locationStats.filesWritten
    filesPreserved += locationStats.filesPreserved

    await writeTimeline(extraction, { timelineDir, onProgress })
    filesWritten += 1

    await writeContinuity(extraction, { continuityDir, onProgress })
    filesWritten += 1

    await writeDashboard(extraction, {
      vaultPath,
      novelTitle: options.novelTitle,
      characterFilenames,
      locationFilenames,
      chapterFilenames,
      onProgress,
      genrePresetId: options.genrePresetId
    })
    filesWritten += 1

    await writeExtractionLog(metaDir, extraction, warnings)

    return {
      filesWritten,
      filesPreserved,
      vaultPath,
      durationMs: Date.now() - startTime
    }
  } catch (err) {
    if (err instanceof VaultGenerationError) throw err
    throw new VaultGenerationError(
      `Vault generation failed: ${(err as Error).message}`,
      'write',
      err
    )
  }
}

function validateInputs(
  extraction: ExtractionResult,
  scrivenerProject: ScrivenerProject,
  vaultPath: string,
  options: VaultGeneratorOptions
): void {
  if (!extraction || typeof extraction !== 'object') {
    throw new VaultGenerationError('extraction is required', 'input')
  }
  const requiredArrays: Array<keyof ExtractionResult> = [
    'chapters',
    'characters',
    'locations',
    'timeline',
    'continuityIssues',
    'warnings'
  ]
  for (const key of requiredArrays) {
    if (!Array.isArray(extraction[key])) {
      throw new VaultGenerationError(
        `extraction.${String(key)} must be an array`,
        'input'
      )
    }
  }
  if (!scrivenerProject || !Array.isArray(scrivenerProject.chapters)) {
    throw new VaultGenerationError(
      'scrivenerProject.chapters must be an array',
      'input'
    )
  }
  if (typeof vaultPath !== 'string' || vaultPath.length === 0) {
    throw new VaultGenerationError(
      'vaultPath must be a non-empty string',
      'input'
    )
  }
  if (!options || typeof options.novelTitle !== 'string') {
    throw new VaultGenerationError(
      'options.novelTitle must be a string',
      'input'
    )
  }
}

/**
 * Delete any stray `.md` files directly under `Characters/` (top-level). Under
 * the tier-subfolder layout, no character file should live at the top level —
 * everything goes into `Main/`, `Secondary/`, `Minor/`, or `Mentioned/`. Files
 * left here are from pre-tier-subfolder vaults and would otherwise show as
 * duplicates alongside the new structured files.
 */
async function cleanupLegacyFlatCharacters(
  charactersDir: string,
  warnings: string[]
): Promise<void> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(charactersDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.md')) continue
    const legacy = join(charactersDir, entry.name)
    try {
      await unlink(legacy)
      warnings.push(
        `Removed legacy character file at '${entry.name}' (now lives in a tier subfolder).`
      )
    } catch (err) {
      warnings.push(
        `Failed to remove legacy character file '${entry.name}': ${(err as Error).message}`
      )
    }
  }
}

async function ensureDirectory(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch (err) {
    throw new VaultGenerationError(
      `Failed to create directory '${dir}': ${(err as Error).message}`,
      'path',
      err
    )
  }
}

function buildChapterIndexes(
  extraction: ExtractionResult,
  scrivenerProject: ScrivenerProject,
  warnings: string[]
): {
  chapterFilenames: Map<number, string>
  chaptersByUuid: Map<string, ScrivenerChapter>
} {
  const chaptersByUuid = new Map<string, ScrivenerChapter>()
  for (const ch of scrivenerProject.chapters) chaptersByUuid.set(ch.uuid, ch)

  const chapterFilenames = new Map<number, string>()
  const seenBasenames = new Set<string>()
  const orderedChapters = extraction.chapters
    .slice()
    .sort((a, b) => a.chapterOrder - b.chapterOrder)
  for (const ch of orderedChapters) {
    const full = buildChapterFilename(ch.chapterOrder, ch.chapterTitle)
    const stem = full.endsWith('.md') ? full.slice(0, -3) : full
    let candidate = stem
    let counter = 2
    while (seenBasenames.has(candidate.toLowerCase())) {
      candidate = `${stem} (${counter})`
      counter += 1
      if (counter > 10_000) {
        throw new VaultGenerationError(
          `Unable to allocate unique chapter filename for order ${ch.chapterOrder}`,
          'write'
        )
      }
    }
    seenBasenames.add(candidate.toLowerCase())
    chapterFilenames.set(ch.chapterOrder, candidate)
    if (!chaptersByUuid.has(ch.chapterUuid)) {
      warnings.push(
        `Chapter UUID '${ch.chapterUuid}' (order ${ch.chapterOrder}) missing from Scrivener project`
      )
    }
  }
  return { chapterFilenames, chaptersByUuid }
}

async function writeExtractionLog(
  metaDir: string,
  extraction: ExtractionResult,
  vaultWarnings: string[]
): Promise<void> {
  const log = {
    generatedAt: new Date().toISOString(),
    extractionGeneratedAt: extraction.generatedAt,
    projectName: extraction.projectName,
    tokenUsage: extraction.tokenUsage,
    extractionWarnings: extraction.warnings,
    vaultWarnings,
    counts: {
      chapters: extraction.chapters.length,
      characters: extraction.characters.length,
      locations: extraction.locations.length,
      timelineEvents: extraction.timeline.length,
      continuityIssues: extraction.continuityIssues.length
    },
    extraction
  }
  await writeFileAtomic(
    join(metaDir, 'extraction-log.json'),
    JSON.stringify(log, null, 2) + '\n'
  )
}
