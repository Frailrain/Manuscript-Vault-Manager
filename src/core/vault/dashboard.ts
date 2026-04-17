import { join } from 'node:path'

import type {
  ContinuityIssue,
  ExtractedCharacter,
  ExtractedLocation,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { writeFileAtomic } from './atomic'
import { renderCallout } from './callouts'
import { continuityIssueHeading, countBySeverity } from './continuity'
import { buildFrontmatter } from './frontmatter'
import { stripHeadingMarkers } from './sanitize'

const DASHBOARD_FILENAME = 'Dashboard.md'

export interface DashboardWriteContext {
  vaultPath: string
  novelTitle: string
  characterFilenames: Map<string, string>
  locationFilenames: Map<string, string>
  chapterFilenames: Map<number, string>
  onProgress?: (progress: VaultProgress) => void
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
  if (extraction.characters.length === 0) {
    sections.push('_(none)_')
  } else {
    for (const char of sortByNameInsensitive(extraction.characters)) {
      const filename = ctx.characterFilenames.get(char.name) ?? char.name
      sections.push(
        `- [[${filename}]] (${char.appearances.length} ${pluralize(char.appearances.length, 'chapter')})`
      )
    }
  }
  sections.push('')

  sections.push('## Locations', '')
  if (extraction.locations.length === 0) {
    sections.push('_(none)_')
  } else {
    for (const loc of sortByNameInsensitive(extraction.locations)) {
      const filename = ctx.locationFilenames.get(loc.name) ?? loc.name
      sections.push(
        `- [[${filename}]] (${loc.appearances.length} ${pluralize(loc.appearances.length, 'chapter')})`
      )
    }
  }
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
      const link = filename ? `[[${filename}]]` : `Chapter ${ch.chapterOrder}`
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

function summaryPreview(summary: string): string {
  const trimmed = stripHeadingMarkers(summary).trim()
  if (trimmed.length === 0) return ''
  const dotIdx = trimmed.indexOf('.')
  const firstSentence =
    dotIdx > 0 ? trimmed.slice(0, dotIdx + 1).trim() : trimmed
  if (firstSentence.length <= 120) return firstSentence
  return firstSentence.slice(0, 120).trimEnd() + '…'
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
