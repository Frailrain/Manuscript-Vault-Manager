import { join } from 'node:path'

import type {
  ExtractedCharacter,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { buildFrontmatter } from './frontmatter'
import { managedBlock } from './managed'
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

  const descriptionBlock = managedBlock(
    character.description.trim().length > 0
      ? character.description
      : '*(not specified)*'
  )

  const roleBlock = managedBlock(
    character.role.trim().length > 0 ? character.role : '*(not specified)*'
  )

  const relationshipsBody =
    character.relationships.length > 0
      ? character.relationships
          .map((rel) => renderRelationshipLine(rel, ctx, character.name))
          .join('\n')
      : '*(none recorded)*'
  const relationshipsBlock = managedBlock(relationshipsBody)

  const appearancesBody =
    character.appearances.length > 0
      ? character.appearances
          .map((order) => `- ${chapterWikiLink(order, ctx.chapterFilenames)}`)
          .join('\n')
      : '*(none)*'
  const appearancesBlock = managedBlock(appearancesBody)

  const lines: string[] = [
    frontmatter.trimEnd(),
    '',
    `# ${character.name}`,
    '',
    '## Description',
    '',
    descriptionBlock,
    '',
    '## Role',
    '',
    roleBlock,
    '',
    '## Relationships',
    '',
    relationshipsBlock,
    '',
    '## Appearances',
    '',
    appearancesBlock,
    '',
    "## Writer's Notes",
    ''
  ]

  return lines.join('\n') + '\n'
}

function renderRelationshipLine(
  rel: { name: string; relationship: string },
  ctx: CharacterWriteContext,
  sourceName: string
): string {
  const canonical = ctx.characterResolver.resolve(rel.name)
  if (canonical) {
    const filename = ctx.characterFilenames.get(canonical) ?? canonical
    return `- **[[${filename}]]** — ${rel.relationship}`
  }
  ctx.warnings.push(
    `Unresolved character reference: '${rel.name}' in ${sourceName} relationships`
  )
  return `- **${rel.name}** — ${rel.relationship}`
}
