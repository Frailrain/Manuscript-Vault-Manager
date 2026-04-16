import { join } from 'node:path'

import type {
  ContinuityIssue,
  ContinuitySeverity,
  ExtractedCharacter,
  ExtractedLocation,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { writeFileAtomic } from './atomic'
import { continuityIssueHeading, countBySeverity } from './continuity'
import { buildFrontmatter } from './frontmatter'
import { stripHeadingMarkers } from './sanitize'

const DASHBOARD_FILENAME = 'Dashboard.md'
const SEVERITY_RANK: Record<ContinuitySeverity, number> = {
  high: 0,
  medium: 1,
  low: 2
}
const SEVERITY_LABEL: Record<ContinuitySeverity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
}

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
    '## Stats',
    '',
    `- **Chapters:** ${extraction.chapters.length}`,
    `- **Characters:** ${extraction.characters.length}`,
    `- **Locations:** ${extraction.locations.length}`,
    `- **Timeline events:** ${extraction.timeline.length}`,
    `- **Continuity issues:** ${extraction.continuityIssues.length} (${counts.high} high / ${counts.medium} medium / ${counts.low} low)`,
    '',
    '## Last Sync',
    '',
    `- **Completed:** ${formatUtcHuman(now)}`,
    `- **Tokens:** ${extraction.tokenUsage.inputTokens.toLocaleString(
      'en-US'
    )} in / ${extraction.tokenUsage.outputTokens.toLocaleString('en-US')} out`,
    `- **Estimated cost:** $${extraction.tokenUsage.estimatedCostUSD.toFixed(2)}`,
    ''
  ]

  const recentIssues = selectRecentIssues(extraction.continuityIssues, 5)
  if (recentIssues.length > 0) {
    sections.push('## Recent Continuity Issues', '')
    for (const issue of recentIssues) {
      const heading = continuityIssueHeading(issue)
      const anchor = `[[Flagged Issues#${heading}]]`
      sections.push(`- ${SEVERITY_LABEL[issue.severity]}: ${anchor}`)
    }
    sections.push('', '_(up to 5 most severe)_', '')
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

function selectRecentIssues(
  issues: ContinuityIssue[],
  limit: number
): ContinuityIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (sev !== 0) return sev
      return (a.chapters[0] ?? 0) - (b.chapters[0] ?? 0)
    })
    .slice(0, limit)
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
