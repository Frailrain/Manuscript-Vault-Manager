import { join } from 'node:path'

import type {
  ContinuityIssue,
  ContinuitySeverity,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { writeFileAtomic } from './atomic'
import { renderCallout, type CalloutType } from './callouts'
import { buildFrontmatter } from './frontmatter'
import { sanitizeLLMText } from './sanitize'

const CONTINUITY_FILENAME = 'Flagged Issues.md'

const SEVERITY_ORDER: ContinuitySeverity[] = ['high', 'medium', 'low']
const SEVERITY_LABELS: Record<ContinuitySeverity, string> = {
  high: 'High Severity',
  medium: 'Medium Severity',
  low: 'Low Severity'
}
const SEVERITY_CALLOUTS: Record<ContinuitySeverity, CalloutType> = {
  high: 'danger',
  medium: 'warning',
  low: 'caution'
}

export interface ContinuityWriteContext {
  continuityDir: string
  onProgress?: (progress: VaultProgress) => void
}

export async function writeContinuity(
  extraction: ExtractionResult,
  ctx: ContinuityWriteContext
): Promise<void> {
  ctx.onProgress?.({
    phase: 'continuity',
    current: 1,
    total: 1,
    currentFile: CONTINUITY_FILENAME
  })
  const path = join(ctx.continuityDir, CONTINUITY_FILENAME)
  await writeFileAtomic(path, buildContinuityFile(extraction))
}

export interface ContinuityIssueHeading {
  issue: ContinuityIssue
  headingText: string
}

/**
 * Build the short title text for an issue. Uses "Chapter N: short-description"
 * where short-description is the first sentence or first 60 chars, whichever
 * is shorter. Exposed so the dashboard can regenerate identical anchor text.
 */
export function continuityIssueHeading(issue: ContinuityIssue): string {
  const short = shortenDescription(issue.description)
  const chapter = issue.chapters[0]
  if (chapter === undefined) return short
  return `Chapter ${chapter}: ${short}`
}

function shortenDescription(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length === 0) return '(no description)'
  const sentenceMatch = trimmed.match(/^[^.!?]+[.!?]/)
  const sentence = sentenceMatch ? sentenceMatch[0].trim() : trimmed
  const clean = sentence.replace(/[.!?]+$/, '').trim()
  if (clean.length <= 60) return clean
  return clean.slice(0, 60).trimEnd() + '…'
}

function buildContinuityFile(extraction: ExtractionResult): string {
  const counts = countBySeverity(extraction.continuityIssues)
  const frontmatter = buildFrontmatter({
    type: 'continuity',
    issueCount: extraction.continuityIssues.length,
    highSeverityCount: counts.high,
    mediumSeverityCount: counts.medium,
    lowSeverityCount: counts.low
  })

  if (extraction.continuityIssues.length === 0) {
    return (
      frontmatter +
      '# Flagged Continuity Issues\n\nNo continuity issues detected.\n'
    )
  }

  const sections: string[] = [
    '# Flagged Continuity Issues',
    '',
    '<!-- This file is regenerated on every sync. Resolved issues should be fixed in the manuscript, not deleted here. -->',
    ''
  ]

  for (const severity of SEVERITY_ORDER) {
    const bucket = extraction.continuityIssues.filter(
      (i) => i.severity === severity
    )
    if (bucket.length === 0) continue
    sections.push(`## ${SEVERITY_LABELS[severity]}`, '')
    const sorted = bucket
      .slice()
      .sort((a, b) => (a.chapters[0] ?? 0) - (b.chapters[0] ?? 0))
    for (const issue of sorted) {
      const body = [
        `**Description:** ${sanitizeLLMText(issue.description)}`,
        '',
        `**Suggestion:** ${sanitizeLLMText(issue.suggestion)}`
      ].join('\n')
      sections.push(
        renderCallout({
          type: SEVERITY_CALLOUTS[severity],
          title: continuityIssueHeading(issue),
          body
        }),
        ''
      )
    }
  }

  return frontmatter + sections.join('\n').trimEnd() + '\n'
}

export function countBySeverity(
  issues: ContinuityIssue[]
): Record<ContinuitySeverity, number> {
  const counts: Record<ContinuitySeverity, number> = {
    high: 0,
    medium: 0,
    low: 0
  }
  for (const issue of issues) counts[issue.severity] += 1
  return counts
}
