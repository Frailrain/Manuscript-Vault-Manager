import { join } from 'node:path'

import type {
  CharacterTier,
  ContinuityIssue,
  ExtractedCharacter,
  ExtractedLocation,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { writeFileAtomic } from './atomic'
import { renderCallout } from './callouts'
import { continuityIssueHeading, countBySeverity } from './continuity'
import { basenameOf } from './filenames'
import { buildFrontmatter } from './frontmatter'
import { sanitizeLLMText } from './sanitize'

const DASHBOARD_FILENAME = 'Dashboard.md'

export interface DashboardWriteContext {
  vaultPath: string
  novelTitle: string
  characterFilenames: Map<string, string>
  locationFilenames: Map<string, string>
  chapterFilenames: Map<number, string>
  onProgress?: (progress: VaultProgress) => void
  genrePresetId?: string
}

export async function writeDashboard(
  extraction: ExtractionResult,
  ctx: DashboardWriteContext
): Promise<void> {
  ctx.onProgress?.({
    phase: 'dashboard',
    current: 1,
    total: 1,
    currentFile: DASHBOARD_FILENAME
  })
  const path = join(ctx.vaultPath, DASHBOARD_FILENAME)
  await writeFileAtomic(path, buildDashboardFile(extraction, ctx))
}

function buildDashboardFile(
  extraction: ExtractionResult,
  ctx: DashboardWriteContext
): string {
  const now = new Date()
  const frontmatter = buildFrontmatter({
    type: 'dashboard',
    lastSync: now.toISOString()
  })

  const counts = countBySeverity(extraction.continuityIssues)

  const sections: string[] = [
    `# ${ctx.novelTitle} — Vault Dashboard`,
    '',
    '<!-- Regenerated on every sync. -->',
    '',
    renderStatsCallout(extraction, now),
    ''
  ]

  const highIssues = extraction.continuityIssues.filter(
    (i) => i.severity === 'high'
  )
  if (counts.high > 0) {
    sections.push(renderHighSeverityCallout(highIssues), '')
  }

  sections.push('## Characters', '')
  sections.push(...renderCharactersSection(extraction.characters, ctx))
  sections.push('')

  sections.push('## Locations', '')
  sections.push(...renderLocationsSection(extraction.locations, ctx))
  sections.push('')

  sections.push('## Chapters', '')
  if (extraction.chapters.length === 0) {
    sections.push('_(none)_')
  } else {
    const ordered = extraction.chapters
      .slice()
      .sort((a, b) => a.chapterOrder - b.chapterOrder)
    for (const ch of ordered) {
      const filename = ctx.chapterFilenames.get(ch.chapterOrder)
      const link = filename
        ? `[[${basenameOf(filename)}]]`
        : `Chapter ${ch.chapterOrder}`
      const preview = summaryPreview(ch.summary)
      sections.push(`${ch.chapterOrder}. ${link}${preview ? ` — ${preview}` : ''}`)
    }
  }
  sections.push('')

  return frontmatter + sections.join('\n').trimEnd() + '\n'
}

function renderStatsCallout(extraction: ExtractionResult, now: Date): string {
  const counts = countBySeverity(extraction.continuityIssues)
  const totalIssues = extraction.continuityIssues.length

  const line1 =
    `**Chapters:** ${extraction.chapters.length} · ` +
    `**Characters:** ${extraction.characters.length} · ` +
    `**Locations:** ${extraction.locations.length} · ` +
    `**Events:** ${extraction.timeline.length}`

  const issuesLine =
    totalIssues === 0
      ? '**Continuity issues:** none'
      : `**Continuity issues:** ${totalIssues} (${counts.high} high · ${counts.medium} medium · ${counts.low} low)`

  const cost = `$${extraction.tokenUsage.estimatedCostUSD.toFixed(2)}`
  const lastSync = `**Last sync:** ${formatUtcHuman(now)} · ${cost}`

  return renderCallout({
    type: 'abstract',
    title: 'Stats',
    body: [line1, issuesLine, lastSync].join('\n')
  })
}

function renderCharactersSection(
  characters: ExtractedCharacter[],
  ctx: DashboardWriteContext
): string[] {
  if (characters.length === 0) return ['_(none)_']
  const mainChars = sortByNameInsensitive(
    characters.filter((c) => c.tier === 'main')
  )
  const otherTiers: CharacterTier[] = ['secondary', 'minor', 'mentioned']
  const otherChars = characters.filter((c) =>
    (otherTiers as CharacterTier[]).includes(c.tier)
  )

  const out: string[] = []
  if (mainChars.length === 0) {
    out.push('_(no main characters)_')
  } else {
    for (const char of mainChars) {
      out.push(mainCharacterLine(char, ctx))
    }
  }

  if (otherChars.length > 0) {
    out.push('')
    out.push(renderOtherCharactersCallout(otherChars, ctx))
  }
  return out
}

function mainCharacterLine(
  char: ExtractedCharacter,
  ctx: DashboardWriteContext
): string {
  const filename = ctx.characterFilenames.get(char.name) ?? char.name
  const link = `[[${basenameOf(filename)}]]`
  const inline = characterInlineSuffix(char, ctx.genrePresetId)
  return `- ${link}${inline} (main, ${appearanceText(char.appearances.length)})`
}

function renderOtherCharactersCallout(
  others: ExtractedCharacter[],
  ctx: DashboardWriteContext
): string {
  const grouping: Array<{ tier: CharacterTier; heading: string }> = [
    { tier: 'secondary', heading: 'Secondary' },
    { tier: 'minor', heading: 'Minor' },
    { tier: 'mentioned', heading: 'Mentioned' }
  ]
  const bodyLines: string[] = []
  for (const { tier, heading } of grouping) {
    const inTier = sortByNameInsensitive(others.filter((c) => c.tier === tier))
    if (inTier.length === 0) continue
    if (bodyLines.length > 0) bodyLines.push('')
    bodyLines.push(`### ${heading}`)
    for (const char of inTier) {
      bodyLines.push(otherCharacterLine(char, ctx))
    }
  }
  return renderCallout({
    type: 'info',
    title: `Other Characters (${others.length})`,
    foldable: true,
    body: bodyLines.join('\n')
  })
}

function otherCharacterLine(
  char: ExtractedCharacter,
  ctx: DashboardWriteContext
): string {
  const filename = ctx.characterFilenames.get(char.name) ?? char.name
  const link = `[[${basenameOf(filename)}]]`
  const count = char.appearances.length
  const suffix = count === 0 ? 'only referenced' : appearanceText(count)
  return `- ${link} (${suffix})`
}

function appearanceText(count: number): string {
  return `${count} ${pluralize(count, 'chapter')}`
}

function renderLocationsSection(
  locations: ExtractedLocation[],
  ctx: DashboardWriteContext
): string[] {
  const topLevel = locations.filter((loc) => loc.parentLocation === null)
  if (topLevel.length === 0) return ['_(none)_']
  const out: string[] = []
  for (const loc of sortByNameInsensitive(topLevel)) {
    const filename = ctx.locationFilenames.get(loc.name) ?? loc.name
    out.push(
      `- [[${basenameOf(filename)}]] (${appearanceText(loc.appearances.length)})`
    )
  }
  return out
}

function renderHighSeverityCallout(highIssues: ContinuityIssue[]): string {
  const sorted = highIssues
    .slice()
    .sort((a, b) => (a.chapters[0] ?? 0) - (b.chapters[0] ?? 0))
  const bulletLines = sorted.map((issue) => {
    const heading = continuityIssueHeading(issue)
    return `- [[Flagged Issues#${heading}]]`
  })
  return renderCallout({
    type: 'danger',
    title: 'Recent High-Severity Issues',
    body: bulletLines.join('\n')
  })
}

function sortByNameInsensitive<T extends ExtractedCharacter | ExtractedLocation>(
  entities: T[]
): T[] {
  return entities
    .slice()
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
}

function characterInlineSuffix(
  char: ExtractedCharacter,
  genrePresetId: string | undefined
): string {
  if (genrePresetId !== 'litrpg') return ''
  const level = char.customFields.level
  const klass = char.customFields.class
  const parts: string[] = []
  if (typeof level === 'number' && Number.isFinite(level)) {
    parts.push(`Level ${level}`)
  }
  if (typeof klass === 'string' && klass.trim().length > 0) {
    parts.push(klass.trim())
  }
  if (parts.length === 0) return ''
  return ` — ${parts.join(' ')}`
}

function summaryPreview(summary: string): string {
  const trimmed = summary.trim()
  if (trimmed.length === 0) return ''
  const dotIdx = trimmed.indexOf('.')
  const firstSentence =
    dotIdx > 0 ? trimmed.slice(0, dotIdx + 1).trim() : trimmed
  const sliced =
    firstSentence.length <= 120
      ? firstSentence
      : firstSentence.slice(0, 120).trimEnd() + '…'
  return sanitizeLLMText(sliced)
}

function pluralize(count: number, word: string): string {
  return count === 1 ? word : `${word}s`
}

function formatUtcHuman(d: Date): string {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`
}
