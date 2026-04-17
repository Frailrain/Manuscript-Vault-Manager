import { join } from 'node:path'

import type {
  ExtractedCharacter,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { renderCallout } from './callouts'
import {
  parseChapterTaggedDescription,
  synthesizeDescription
} from './descriptions'
import { buildFrontmatter } from './frontmatter'
import { stripHeadingMarkers } from './sanitize'
import { writeManagedFile } from './writeManaged'
import { chapterWikiLink, type NameResolver } from './wikilinks'

export interface CharacterWriteContext {
  charactersDir: string
  characterFilenames: Map<string, string>
  characterResolver: NameResolver
  chapterFilenames: Map<number, string>
  warnings: string[]
  onProgress?: (progress: VaultProgress) => void
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
  const fmFields: Record<string, unknown> = {
    type: 'character',
    name: character.name
  }
  if (character.aliases.length > 0) fmFields.aliases = character.aliases
  fmFields.role = character.role || null
  fmFields.firstAppearance = character.firstAppearanceChapter
  fmFields.appearances = [...character.appearances]

  const frontmatter = buildFrontmatter(fmFields)

  const atAGlance = renderAtAGlance(character)
  const descriptionSection = renderDescriptionSection(character.description)
  const relationshipsSection = renderRelationshipsSection(character, ctx)
  const appearancesSection = renderAppearancesSection(character, ctx)

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
    '',
    '## Appearances',
    '',
    appearancesSection,
    '',
    "## Writer's Notes",
    ''
  ]

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

function renderDescriptionSection(rawDescription: string): string {
  const trimmed = rawDescription.trim()
  if (trimmed.length === 0) {
    return '*(not specified)*'
  }

  const blocks = parseChapterTaggedDescription(trimmed)
  const synthesized = stripHeadingMarkers(synthesizeDescription(trimmed))

  if (blocks.length < 2) {
    return synthesized
  }

  const perChapterBody = blocks
    .map(
      (b) => `**Chapter ${b.chapterOrder}:** ${stripHeadingMarkers(b.text)}`
    )
    .join('\n')
  const perChapterCallout = renderCallout({
    type: 'note',
    title: 'Per-chapter detail',
    body: perChapterBody,
    foldable: true
  })

  return `${synthesized}\n\n${perChapterCallout}`
}

function renderRelationshipsSection(
  character: ExtractedCharacter,
  ctx: CharacterWriteContext
): string {
  if (character.relationships.length === 0) {
    return '*(none recorded)*'
  }
  return character.relationships
    .map((rel) => renderRelationshipCallout(rel, ctx, character.name))
    .join('\n\n')
}

function renderRelationshipCallout(
  rel: { name: string; relationship: string },
  ctx: CharacterWriteContext,
  sourceName: string
): string {
  const relationship = stripHeadingMarkers(rel.relationship)
  const canonical = ctx.characterResolver.resolve(rel.name)
  let title: string
  if (canonical) {
    const filename = ctx.characterFilenames.get(canonical) ?? canonical
    title = `[[${filename}]]`
  } else {
    ctx.warnings.push(
      `Unresolved character reference: '${rel.name}' in ${sourceName} relationships`
    )
    title = rel.name
  }
  return renderCallout({
    type: 'info',
    title,
    body: relationship
  })
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
