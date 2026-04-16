import { readFile, access } from 'node:fs/promises'

import type {
  ScrivenerChapter,
  ScrivenerProject,
  ScrivenerScene
} from '../../shared/types'
import { ScrivenerParseError } from './errors'
import { flattenDraft, type FlatChapter } from './binder'
import { hashContent } from './hashing'
import { contentRtfPath, resolveProjectPaths, synopsisPath } from './paths'
import { countWords, rtfToPlainText } from './rtf'
import {
  findDraftFolder,
  parseScrivx,
  resolveLabel,
  type ParsedScrivx,
  type RawBinderItem
} from './scrivx'

export async function parseScrivenerProject(
  projectPath: string
): Promise<ScrivenerProject> {
  const paths = await resolveProjectPaths(projectPath)

  let xml: string
  try {
    xml = await readFile(paths.scrivxFile, 'utf8')
  } catch (err) {
    throw new ScrivenerParseError(
      `Cannot read .scrivx file at ${paths.scrivxFile}`,
      err
    )
  }

  const parsed = parseScrivx(xml)
  const draft = findDraftFolder(parsed.binderItems)
  if (!draft) {
    throw new ScrivenerParseError(
      'No DraftFolder found in Binder — unsupported Scrivener version or malformed project'
    )
  }

  const warnings: string[] = []
  const flats = flattenDraft(draft, warnings)

  const chapters: ScrivenerChapter[] = []
  for (let i = 0; i < flats.length; i++) {
    const chapter = await buildChapter(flats[i]!, i + 1, paths.dataDir, parsed, warnings)
    chapters.push(chapter)
  }

  return {
    projectPath: paths.scrivFolder,
    projectName: paths.projectName,
    parsedAt: new Date().toISOString(),
    chapters,
    warnings
  }
}

async function buildChapter(
  flat: FlatChapter,
  order: number,
  dataDir: string,
  parsed: ParsedScrivx,
  warnings: string[]
): Promise<ScrivenerChapter> {
  const source = flat.source
  const synopsis = await readSynopsisIfPresent(dataDir, source.uuid)
  const chapterLabel = resolveLabel(source.labelValue, parsed.labels)
  const chapterStatus = resolveLabel(source.statusValue, parsed.statuses)

  if (flat.kind === 'leaf-text') {
    const content = await readContentRtf(dataDir, source.uuid, warnings, {
      quiet: false
    })
    const scene: ScrivenerScene = {
      uuid: source.uuid,
      title: source.title,
      order: 1,
      content,
      wordCount: countWords(content),
      contentHash: hashContent(content),
      synopsis,
      label: chapterLabel,
      status: chapterStatus
    }
    return {
      uuid: source.uuid,
      title: source.title,
      order,
      parentTitle: flat.parentTitle,
      scenes: [scene],
      synopsis,
      label: chapterLabel,
      status: chapterStatus
    }
  }

  const scenes: ScrivenerScene[] = []
  const introContent = await readContentRtf(dataDir, source.uuid, warnings, {
    quiet: true
  })
  if (introContent.length > 0) {
    scenes.push({
      uuid: source.uuid,
      title: '(Chapter intro)',
      order: 0,
      content: introContent,
      wordCount: countWords(introContent),
      contentHash: hashContent(introContent),
      synopsis: null,
      label: chapterLabel,
      status: chapterStatus
    })
  }

  for (let i = 0; i < flat.sceneItems.length; i++) {
    const sceneSource = flat.sceneItems[i]!
    const content = await readContentRtf(dataDir, sceneSource.uuid, warnings, {
      quiet: false
    })
    const sceneSynopsis = await readSynopsisIfPresent(dataDir, sceneSource.uuid)
    scenes.push({
      uuid: sceneSource.uuid,
      title: sceneSource.title,
      order: i + 1,
      content,
      wordCount: countWords(content),
      contentHash: hashContent(content),
      synopsis: sceneSynopsis,
      label: resolveLabel(sceneSource.labelValue, parsed.labels),
      status: resolveLabel(sceneSource.statusValue, parsed.statuses)
    })
  }

  return {
    uuid: source.uuid,
    title: source.title,
    order,
    parentTitle: flat.parentTitle,
    scenes,
    synopsis,
    label: chapterLabel,
    status: chapterStatus
  }
}

async function readContentRtf(
  dataDir: string,
  uuid: string,
  warnings: string[],
  opts: { quiet: boolean }
): Promise<string> {
  const file = contentRtfPath(dataDir, uuid)
  try {
    await access(file)
  } catch {
    if (!opts.quiet) {
      warnings.push(`Missing content.rtf for item ${uuid}`)
    }
    return ''
  }
  try {
    const rtf = await readFile(file, 'utf8')
    return rtfToPlainText(rtf)
  } catch (err) {
    warnings.push(
      `Failed to read content.rtf for item ${uuid}: ${(err as Error).message}`
    )
    return ''
  }
}

async function readSynopsisIfPresent(
  dataDir: string,
  uuid: string
): Promise<string | null> {
  const file = synopsisPath(dataDir, uuid)
  try {
    const text = await readFile(file, 'utf8')
    const trimmed = text.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

export type { RawBinderItem }
