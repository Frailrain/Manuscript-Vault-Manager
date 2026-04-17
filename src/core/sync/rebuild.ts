import type {
  ChapterContribution,
  ChapterExtraction,
  ContinuityIssue,
  ExtractedCharacter,
  ExtractedLocation,
  ScrivenerChapter,
  TimelineEvent
} from '../../shared/types'
import {
  mergeCharacters,
  mergeContinuity,
  mergeLocations,
  mergeTimeline,
  sortTimeline
} from '../extraction/merge'

export interface RebuiltMergedState {
  chapters: ChapterExtraction[]
  characters: ExtractedCharacter[]
  locations: ExtractedLocation[]
  timeline: TimelineEvent[]
  continuityIssues: ContinuityIssue[]
  warnings: string[]
}

/**
 * Rebuild the fully-merged extraction state from a set of per-chapter
 * contributions. Chapter orders come from `currentChapters` (the current
 * project), not from what was captured when the contribution was originally
 * extracted — so if a chapter moves from position 3 to position 5, every
 * appearance, timeline event, and continuity issue attributed to it is
 * renumbered to 5.
 *
 * Contributions whose UUIDs are no longer in the current project are dropped
 * with a warning.
 */
export function rebuildMergedState(
  contributions: ChapterContribution[],
  chapterExtractions: ChapterExtraction[],
  currentChapters: ScrivenerChapter[]
): RebuiltMergedState {
  const warnings: string[] = []
  const orderByUuid = new Map(
    currentChapters.map((ch) => [ch.uuid, ch.order])
  )
  const titleByUuid = new Map(
    currentChapters.map((ch) => [ch.uuid, ch.title])
  )

  const alignedContributions: Array<{
    contribution: ChapterContribution
    currentOrder: number
  }> = []
  for (const contribution of contributions) {
    const currentOrder = orderByUuid.get(contribution.chapterUuid)
    if (currentOrder === undefined) {
      warnings.push(
        `Dropped contribution for chapter UUID ${contribution.chapterUuid} — no longer in project.`
      )
      continue
    }
    alignedContributions.push({ contribution, currentOrder })
  }
  alignedContributions.sort((a, b) => a.currentOrder - b.currentOrder)

  const characters: ExtractedCharacter[] = []
  const locations: ExtractedLocation[] = []
  const timeline: TimelineEvent[] = []
  const continuityIssues: ContinuityIssue[] = []

  for (const { contribution, currentOrder } of alignedContributions) {
    mergeCharacters(characters, contribution.characterDeltas, currentOrder)
    mergeLocations(locations, contribution.locationDeltas, currentOrder)
    mergeTimeline(timeline, contribution.timelineEvents, currentOrder)
    mergeContinuity(continuityIssues, contribution.continuityIssues, currentOrder)
  }

  const extractionsByUuid = new Map(
    chapterExtractions.map((ch) => [ch.chapterUuid, ch])
  )
  const chapters: ChapterExtraction[] = []
  for (const { contribution, currentOrder } of alignedContributions) {
    const prior = extractionsByUuid.get(contribution.chapterUuid)
    const title =
      titleByUuid.get(contribution.chapterUuid) ??
      prior?.chapterTitle ??
      '(untitled)'
    if (prior) {
      chapters.push({
        ...prior,
        chapterOrder: currentOrder,
        chapterTitle: title
      })
    } else {
      chapters.push({
        chapterOrder: currentOrder,
        chapterUuid: contribution.chapterUuid,
        chapterTitle: title,
        summary: '',
        charactersAppearing: [],
        locationsAppearing: []
      })
    }
  }

  return {
    chapters,
    characters,
    locations,
    timeline: sortTimeline(timeline),
    continuityIssues,
    warnings
  }
}
