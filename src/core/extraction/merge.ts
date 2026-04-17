import type { GenreFieldDef } from '../../shared/presets'
import type {
  CharacterTier,
  ChapterExtraction,
  ContinuityIssue,
  CustomFieldValue,
  ExtractedCharacter,
  ExtractedLocation,
  TimelineEvent
} from '../../shared/types'
import type { ExtractedCharacterDelta, ExtractedLocationDelta } from './passes'
import type { ContinuityPassResult, TimelinePassResult } from './passes'

const TIER_RANK: Record<CharacterTier, number> = {
  main: 3,
  secondary: 2,
  minor: 1
}

export function mergeTier(
  existing: CharacterTier,
  incoming: CharacterTier
): CharacterTier {
  return TIER_RANK[incoming] > TIER_RANK[existing] ? incoming : existing
}

export function mergeCharacters(
  running: ExtractedCharacter[],
  fromChapter: ExtractedCharacterDelta[],
  chapterOrder: number,
  fieldDefs: GenreFieldDef[] = []
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
      existing.tier = mergeTier(
        existing.tier ?? 'minor',
        normalizeTier(delta.tier)
      )
      existing.customFields = mergeCustomFields(
        existing.customFields,
        delta.customFields,
        fieldDefs
      )
    } else {
      running.push({
        name: delta.name,
        aliases: dedupePreserveCase(delta.aliases),
        description: delta.description,
        role: delta.role,
        relationships: dedupeRelationships(delta.relationships),
        firstAppearanceChapter: chapterOrder,
        appearances: [chapterOrder],
        tier: normalizeTier(delta.tier),
        customFields: mergeCustomFields({}, delta.customFields, fieldDefs)
      })
    }
  }
}

function normalizeTier(tier: CharacterTier | undefined): CharacterTier {
  return tier === 'main' || tier === 'secondary' || tier === 'minor'
    ? tier
    : 'minor'
}

export function mergeLocations(
  running: ExtractedLocation[],
  fromChapter: ExtractedLocationDelta[],
  chapterOrder: number,
  fieldDefs: GenreFieldDef[] = []
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
      if (delta.parentLocation) {
        existing.parentLocation = delta.parentLocation
      }
      existing.customFields = mergeCustomFields(
        existing.customFields,
        delta.customFields,
        fieldDefs
      )
    } else {
      running.push({
        name: delta.name,
        description: delta.description,
        significance: delta.significance,
        firstAppearanceChapter: chapterOrder,
        appearances: [chapterOrder],
        parentLocation: delta.parentLocation ?? null,
        customFields: mergeCustomFields({}, delta.customFields, fieldDefs)
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

/**
 * Merge per-field updates from `incoming` into `existing` following the
 * per-type rules:
 *   - `list`: union, dedupe, preserve insertion order.
 *   - `number`: last-write-wins.
 *   - `text`: last non-empty string wins (trimmed).
 * Unknown keys (not in fieldDefs) are ignored.
 */
export function mergeCustomFields(
  existing: Record<string, CustomFieldValue>,
  incoming: Record<string, CustomFieldValue> | undefined,
  fieldDefs: GenreFieldDef[]
): Record<string, CustomFieldValue> {
  if (!incoming) return { ...existing }
  const result: Record<string, CustomFieldValue> = { ...existing }
  for (const def of fieldDefs) {
    const value = incoming[def.key]
    if (value === undefined || value === null) continue
    if (def.type === 'list' && Array.isArray(value)) {
      const priorList = Array.isArray(result[def.key])
        ? (result[def.key] as string[])
        : []
      const merged = [...priorList]
      for (const item of value) {
        if (typeof item === 'string' && !merged.includes(item)) merged.push(item)
      }
      if (merged.length > 0) result[def.key] = merged
    } else if (def.type === 'number' && typeof value === 'number') {
      if (Number.isFinite(value)) result[def.key] = value
    } else if (
      def.type === 'text' &&
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      result[def.key] = value.trim()
    }
  }
  return result
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
  const byName = new Map<string, number>()
  existing.relationships.forEach((r, idx) => {
    byName.set(normalize(r.name), idx)
  })
  for (const rel of delta.relationships) {
    if (!rel.name || !rel.relationship) continue
    const key = normalize(rel.name)
    const priorIdx = byName.get(key)
    if (priorIdx !== undefined) {
      existing.relationships[priorIdx] = rel
    } else {
      existing.relationships.push(rel)
      byName.set(key, existing.relationships.length - 1)
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
