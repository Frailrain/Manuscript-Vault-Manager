import type {
  ChapterContribution,
  ChapterExtraction,
  ScrivenerProject,
  SyncManifest
} from '../../../../shared/types'
import { hashChapter } from '../../hashing'

export interface BuildManifestOptions {
  projectName?: string
  lastSyncAt?: string
  extraContributions?: ChapterContribution[]
  extraChapterExtractions?: ChapterExtraction[]
  warnings?: string[]
}

/**
 * Build a manifest that matches the chapters in `project` as of the "previous
 * sync". Each chapter gets a placeholder contribution and chapterExtraction so
 * rebuild logic has something to slice.
 */
export function buildManifestFor(
  project: ScrivenerProject,
  options: BuildManifestOptions = {}
): SyncManifest {
  const projectName = options.projectName ?? project.projectName
  const lastSyncAt = options.lastSyncAt ?? '2026-04-16T12:00:00.000Z'
  const extraContributions = options.extraContributions
  const extraChapterExtractions = options.extraChapterExtractions

  const contributions: ChapterContribution[] =
    extraContributions ??
    project.chapters.map((ch) => ({
      chapterOrder: ch.order,
      chapterUuid: ch.uuid,
      characterDeltas: [],
      locationDeltas: [],
      timelineEvents: [{ summary: `Events of ${ch.title}`, sequence: 1 }],
      continuityIssues: []
    }))

  const chapterExtractions: ChapterExtraction[] =
    extraChapterExtractions ??
    project.chapters.map((ch) => ({
      chapterOrder: ch.order,
      chapterUuid: ch.uuid,
      chapterTitle: ch.title,
      summary: `Summary of ${ch.title}`,
      charactersAppearing: [],
      locationsAppearing: []
    }))

  return {
    version: 1,
    lastSyncAt,
    projectName,
    chapters: project.chapters.map((ch) => ({
      chapterUuid: ch.uuid,
      chapterOrder: ch.order,
      chapterTitle: ch.title,
      chapterHash: hashChapter(ch),
      sceneHashes: ch.scenes.map((s) => ({ uuid: s.uuid, hash: s.contentHash }))
    })),
    chapterContributions: contributions,
    cumulativeTokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0
    },
    lastExtractionSnapshot: {
      chapters: chapterExtractions,
      warnings: options.warnings ?? []
    }
  }
}
