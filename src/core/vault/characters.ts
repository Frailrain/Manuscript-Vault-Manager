import { join } from 'node:path'

import type { GenreFieldDef } from '../../shared/presets'
import type {
  ExtractedCharacter,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { renderCallout } from './callouts'
import { synthesizeDescription } from './descriptions'
import { buildFrontmatter } from './frontmatter'
import { stripHeadingMarkers } from './sanitize'
import {
  applyCustomFieldsToFrontmatter,
  renderTrackingCallout
} from './tracking'
import { writeManagedFile } from './writeManaged'
import { chapterWikiLink, type NameResolver } from './wikilinks'

export interface CharacterWriteContext {
  charactersDir: string
  characterFilenames: Map<string, string>
  characterResolver: NameResolver
  chapterFilenames: Map<number, string>
  warnings: string[]
  onProgress?: (progress: VaultProgress) => void
  characterFields?: GenreFieldDef[]
  characterSectionLabel?: string
}

export interface CharacterWriteStats {
  filesWritten: number
  filesPreserved: number
}

export async function writeCharacters(
  extraction: ExtractionResult,
  ctx: CharacterWriteContext
): Promise<CharacterWriteStats> {
  const stats: CharacterWriteStats = { filesWritten: 0, filesPreserved: 0 }
  const total = extraction.characters.length
  for (let i = 0; i < extraction.characters.length; i++) {
    const character = extraction.characters[i]!
    const filename = ctx.characterFilenames.get(character.name)
    if (!filename) {
      throw new Error(
        `Internal error: no filename allocated for character '${character.name}'`
      )
    }
    const path = join(ctx.charactersDir, `${filename}.md`)
    ctx.onProgress?.({
      phase: 'characters',
      current: i + 1,
      total,
      currentFile: `${filename}.md`
    })
    const content = buildCharacterFile(character, ctx)
    const outcome = await writeManagedFile(path, content)
    stats.filesWritten += 1
    if (outcome.preserved) stats.filesPreserved += 1
  }
  return stats
}

function buildCharacterFile(
  character: ExtractedCharacter,
  ctx: CharacterWriteContext
): string {
  const fieldDefs = ctx.characterFields ?? []
  const fmFields: Record<string, unknown> = {
    type: 'character',
    name: character.name
  }
  if (character.aliases.length > 0) fmFields.aliases = character.aliases
  fmFields.role = character.role || null
  fmFields.firstAppearance = character.firstAppearanceChapter
  fmFields.appearances = [...character.appearances]
  applyCustomFieldsToFrontmatter(fmFields, fieldDefs, character.customFields)

  const frontmatter = buildFrontmatter(fmFields)

  const atAGlance = renderAtAGlance(character)
  const descriptionSection = renderDescriptionSection(character)
  const relationshipsSection = renderRelationshipsSection(character, ctx)
  const appearancesSection = renderAppearancesSection(character, ctx)

  const trackingCallout = renderTrackingCallout(
    ctx.characterSectionLabel ?? '',
    fieldDefs,
    character.customFields
  )

  const lines: string[] = [
    frontmatter.trimEnd(),
    '',
    `# ${character.name}`,
    '',
    atAGlance,
    '',
    '## Description',
    '',
    descriptionSection,
    '',
    '## Relationships',
    '',
    relationshipsSection,
    ''
  ]
  if (trackingCallout) {
    lines.push(trackingCallout, '')
  }
  lines.push(
    '## Appearances',
    '',
    appearancesSection,
    '',
    "## Writer's Notes",
    ''
  )

  return lines.join('\n') + '\n'
}

function renderAtAGlance(character: ExtractedCharacter): string {
  const bodyLines: string[] = []
  const role = character.role.trim()
  if (role.length > 0) {
    bodyLines.push(`**Role:** ${stripHeadingMarkers(role)}`)
  }
  bodyLines.push(`**First seen:** Chapter ${character.firstAppearanceChapter}`)
  const appearsCount = character.appearances.length
  bodyLines.push(
    `**Appears in:** ${appearsCount} ${appearsCount === 1 ? 'chapter' : 'chapters'}`
  )
  return renderCallout({
    type: 'abstract',
    title: 'At a Glance',
    body: bodyLines.join('\n')
  })
}

function renderDescriptionSection(character: ExtractedCharacter): string {
  const rawDescription = character.description
  const trimmed = rawDescription.trim()
  const identityParagraph =
    trimmed.length === 0
      ? '*(not specified)*'
      : stripHeadingMarkers(synthesizeDescription(trimmed))

  const activityCallout = renderPerChapterActivityCallout(character)
  if (!activityCallout) return identityParagraph
  return `${identityParagraph}\n\n${activityCallout}`
}

function renderPerChapterActivityCallout(
  character: ExtractedCharacter
): string | null {
  const entries = Object.entries(character.chapterActivity ?? {})
    .map(([orderStr, activity]) => ({
      order: Number(orderStr),
      activity: typeof activity === 'string' ? activity.trim() : ''
    }))
    .filter((e) => Number.isFinite(e.order) && e.activity.length > 0)
    .sort((a, b) => a.order - b.order)

  if (entries.length === 0) return null

  const blocks = entries.map((e) => {
    const sentences = e.activity
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    const bullets =
      sentences.length > 0
        ? sentences.map((s) => `- ${stripHeadingMarkers(s)}`).join('\n')
        : `- ${stripHeadingMarkers(e.activity)}`
    return `**Chapter ${e.order}:**\n${bullets}`
  })

  return renderCallout({
    type: 'note',
    title: 'Per-chapter activity',
    body: blocks.join('\n\n'),
    foldable: true
  })
}

function renderRelationshipsSection(
  character: ExtractedCharacter,
  ctx: CharacterWriteContext
): string {
  if (character.relationships.length === 0) {
    return '*(none recorded)*'
  }
  const items = character.relationships.map((rel) =>
    renderRelationshipLine(rel, ctx, character.name)
  )
  return renderCallout({
    type: 'info',
    title: `Relationships (${character.relationships.length})`,
    foldable: true,
    body: items.join('\n')
  })
}

function renderRelationshipLine(
  rel: { name: string; relationship: string },
  ctx: CharacterWriteContext,
  sourceName: string
): string {
  const relationship = stripHeadingMarkers(rel.relationship)
  const canonical = ctx.characterResolver.resolve(rel.name)
  let linkOrName: string
  if (canonical) {
    const filename = ctx.characterFilenames.get(canonical) ?? canonical
    linkOrName = `[[${filename}]]`
  } else {
    ctx.warnings.push(
      `Unresolved character reference: '${rel.name}' in ${sourceName} relationships`
    )
    linkOrName = rel.name
  }
  return `- **${linkOrName}** — ${relationship}`
}

function renderAppearancesSection(
  character: ExtractedCharacter,
  ctx: CharacterWriteContext
): string {
  if (character.appearances.length === 0) return '*(none)*'
  return character.appearances
    .map((order) => `- ${chapterWikiLink(order, ctx.chapterFilenames)}`)
    .join('\n')
}
