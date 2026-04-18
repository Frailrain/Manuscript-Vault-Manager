import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

import type {
  ExtractedCharacter,
  ExtractedLocation,
  ManifestChapterEntry
} from '../../shared/types'
import {
  allocateCharacterFilenames,
  chapterFilename
} from '../vault/filenames'
import { allocateLocationFilenames } from '../vault/locations'

export interface IntegrityCheckInputs {
  chapters: ManifestChapterEntry[]
  characters: ExtractedCharacter[]
  locations: ExtractedLocation[]
  hasTimeline: boolean
  hasContinuity: boolean
}

export interface IntegrityCheckResult {
  hasMissingFiles: boolean
  missingFiles: string[]
  missingCount: number
}

const MAX_REPORTED = 50

/**
 * Verify every expected vault file exists on disk. Uses the same allocators
 * the vault generator uses, so the expected paths are exactly what the
 * generator would write.
 *
 * Scope: chapters, characters, locations, Dashboard.md, Master Timeline.md
 * (when there are timeline events), and Flagged Issues.md (when there are
 * continuity issues).
 */
export async function checkVaultIntegrity(
  vaultPath: string,
  inputs: IntegrityCheckInputs
): Promise<IntegrityCheckResult> {
  const missingFiles: string[] = []
  let missingCount = 0

  const report = (relPath: string): void => {
    missingCount += 1
    if (missingFiles.length < MAX_REPORTED) missingFiles.push(relPath)
  }

  const checkPath = async (relPath: string): Promise<void> => {
    try {
      await access(join(vaultPath, relPath), constants.F_OK)
    } catch {
      report(relPath)
    }
  }

  for (const ch of inputs.chapters) {
    const name = chapterFilename(ch.chapterOrder, ch.chapterTitle)
    await checkPath(join('Chapters', name))
  }

  const charAllocation = allocateCharacterFilenames(inputs.characters)
  for (const [, relPath] of charAllocation.filenames) {
    await checkPath(join('Characters', `${relPath}.md`))
  }

  const locAllocation = allocateLocationFilenames(inputs.locations)
  for (const [, relPath] of locAllocation.filenames) {
    await checkPath(join('Locations', `${relPath}.md`))
  }

  await checkPath('Dashboard.md')
  if (inputs.hasTimeline) {
    await checkPath(join('Timeline', 'Master Timeline.md'))
  }
  if (inputs.hasContinuity) {
    await checkPath(join('Continuity', 'Flagged Issues.md'))
  }

  return {
    hasMissingFiles: missingCount > 0,
    missingFiles,
    missingCount
  }
}
