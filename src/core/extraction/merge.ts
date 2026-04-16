import type {
  ChapterExtraction,
  ContinuityIssue,
  ExtractedCharacter,
  ExtractedLocation,
  TimelineEvent
} from '../../shared/types'
import type { ExtractedCharacterDelta, ExtractedLocationDelta } from './passes'
import type { ContinuityPassResult, TimelinePassResult } from './passes'

export function mergeCharacters(
  running: ExtractedCharacter[],
  fromChapter: ExtractedCharacterDelta[],
  chapterOrder: number
): void {
  for (const delta of fromChapter) {
    const existing = findMatchingCharacter(running, delta)
    if (existing) {
      mergeAliases(existing, delta)
      appendDescriptionIfChanged(existing, delta.description, chapterOrder)
      mergeRelationships(existing, delta)
      if (!existing.appearances.includes(chapterOrder)) {
        existing.appearances.push(chapterOrder)
      }
      if (delta.role && !existing.role) existing.role = delta.role
    } else {
      running.push({
        name: delta.name,
        aliases: dedupePreserveCase(delta.aliases),
        description: delta.description,
        role: delta.role,
        relationships: dedupeRelationships(delta.relationships),
        firstAppearanceChapter: chapterOrder,
        appearances: [chapterOrder]
      })
    }
  }
}

export function mergeLocations(
  running: ExtractedLocation[],
  fromChapter: ExtractedLocationDelta[],
  chapterOrder: number
): void {
  for (const delta of fromChapter) {
    const existing = running.find(
      (loc) => normalize(loc.name) === normalize(delta.name)
    )
    if (existing) {
      appendLocationDescriptionIfChanged(existing, delta.description, chapterOrder)
      if (!existing.significance && delta.significance) {
        existing.significance = delta.significance
      }
      if (!existing.appearances.includes(chapterOrder)) {
        existing.appearances.push(chapterOrder)
      }
    } else {
      running.push({
        name: delta.name,
        description: delta.description,
        significance: delta.significance,
        firstAppearanceChapter: chapterOrder,
        appearances: [chapterOrder]
      })
    }
  }
}

export function mergeTimeline(
  running: TimelineEvent[],
  fromChapter: TimelinePassResult['events'],
  chapterOrder: number
): void {
  for (const event of fromChapter) {
    running.push({
      chapterOrder,
      summary: event.summary,
      sequence: event.sequence
    })
  }
}

export function mergeContinuity(
  running: ContinuityIssue[],
  fromChapter: ContinuityPassResult['issues'],
  chapterOrder: number
): void {
  for (const issue of fromChapter) {
    running.push({
      severity: issue.severity,
      description: issue.description,
      chapters: [chapterOrder],
      suggestion: issue.suggestion
    })
  }
}

export function sortTimeline(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.chapterOrder !== b.chapterOrder) return a.chapterOrder - b.chapterOrder
    return a.sequence - b.sequence
  })
}

export function appendChapterExtraction(
  running: ChapterExtraction[],
  record: ChapterExtraction
): void {
  running.push(record)
}

export function dedupeByNormalizedName<T extends { name: string }>(
  items: T[]
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = normalize(item.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function findMatchingCharacter(
  running: ExtractedCharacter[],
  delta: ExtractedCharacterDelta
): ExtractedCharacter | undefined {
  const deltaNames = new Set([delta.name, ...delta.aliases].map(normalize))
  for (const existing of running) {
    const existingNames = new Set(
      [existing.name, ...existing.aliases].map(normalize)
    )
    for (const n of deltaNames) {
      if (existingNames.has(n)) return existing
    }
  }
  return undefined
}

function mergeAliases(
  existing: ExtractedCharacter,
  delta: ExtractedCharacterDelta
): void {
  const known = new Set(
    [existing.name, ...existing.aliases].map(normalize)
  )
  for (const candidate of [delta.name, ...delta.aliases]) {
    if (!candidate) continue
    if (normalize(candidate) === normalize(existing.name)) continue
    if (!known.has(normalize(candidate))) {
      existing.aliases.push(candidate)
      known.add(normalize(candidate))
    }
  }
}

function mergeRelationships(
  existing: ExtractedCharacter,
  delta: ExtractedCharacterDelta
): void {
  const seen = new Set(
    existing.relationships.map(
      (r) => `${normalize(r.name)}|${normalize(r.relationship)}`
    )
  )
  for (const rel of delta.relationships) {
    const key = `${normalize(rel.name)}|${normalize(rel.relationship)}`
    if (!seen.has(key)) {
      existing.relationships.push(rel)
      seen.add(key)
    }
  }
}

function appendDescriptionIfChanged(
  existing: ExtractedCharacter,
  newDescription: string,
  chapterOrder: number
): void {
  const trimmed = newDescription.trim()
  if (trimmed.length === 0) return
  if (
    existing.description.trim() === trimmed ||
    existing.description.includes(trimmed)
  ) {
    return
  }
  existing.description = existing.description
    ? `${existing.description}\n\n(Ch ${chapterOrder}): ${trimmed}`
    : `(Ch ${chapterOrder}): ${trimmed}`
}

function appendLocationDescriptionIfChanged(
  existing: ExtractedLocation,
  newDescription: string,
  chapterOrder: number
): void {
  const trimmed = newDescription.trim()
  if (trimmed.length === 0) return
  if (
    existing.description.trim() === trimmed ||
    existing.description.includes(trimmed)
  ) {
    return
  }
  existing.description = existing.description
    ? `${existing.description}\n\n(Ch ${chapterOrder}): ${trimmed}`
    : `(Ch ${chapterOrder}): ${trimmed}`
}

function dedupePreserveCase(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (!v) continue
    const key = normalize(v)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function dedupeRelationships(
  rels: Array<{ name: string; relationship: string }>
): Array<{ name: string; relationship: string }> {
  const seen = new Set<string>()
  const out: typeof rels = []
  for (const r of rels) {
    const key = `${normalize(r.name)}|${normalize(r.relationship)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}
