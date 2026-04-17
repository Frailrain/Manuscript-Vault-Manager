import type {
  ChapterChange,
  ChapterContribution,
  ChapterExtraction,
  ExtractionResult,
  LLMProviderConfig,
  ManifestChapterEntry,
  ScrivenerChapter,
  ScrivenerProject,
  SyncManifest,
  SyncOptions,
  SyncPhase,
  SyncProgress,
  SyncResult,
  TokenUsage
} from '../../shared/types'
import { ExtractionError } from '../extraction/errors'
import type { ExtractionFieldDefs } from '../extraction/engine'
import { createProvider } from '../extraction/providers'
import { generateVault } from '../vault/generator'
import { diffProject } from './diff'
import { SyncError } from './errors'
import { hashChapter } from './hashing'
import { readManifest, writeManifest } from './manifest'
import { rebuildMergedState } from './rebuild'
import { reExtractChapters } from './reExtract'

export async function syncProject(
  project: ScrivenerProject,
  vaultPath: string,
  providerConfig: LLMProviderConfig,
  options: SyncOptions
): Promise<SyncResult> {
  const startTime = Date.now()
  const warnings: string[] = []
  const tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUSD: 0
  }
  let filesWritten = 0
  let filesPreserved = 0
  let changes: ChapterChange[] = []

  const fieldDefs: ExtractionFieldDefs = {
    customCharacterFields: providerConfig.customCharacterFields ?? [],
    customLocationFields: providerConfig.customLocationFields ?? [],
    glossary: providerConfig.glossary ?? []
  }

  const onProgress = options.onProgress
  const emit = (phase: SyncPhase, extra: Partial<SyncProgress> = {}): void => {
    const base: SyncProgress = {
      phase,
      tokensUsedSoFar: tokenUsage.inputTokens + tokenUsage.outputTokens,
      estimatedCostSoFar: tokenUsage.estimatedCostUSD
    }
    onProgress?.({ ...base, ...extra })
  }

  emit('reading-manifest')
  const manifest = await readManifest(vaultPath)
  const firstRun = manifest === null

  if (manifest && manifest.projectName !== project.projectName) {
    warnings.push(
      `Manifest project name "${manifest.projectName}" does not match current project "${project.projectName}"; syncing anyway.`
    )
  }

  emit('diffing')
  changes = diffProject(project, manifest)

  const changedUuids = new Set(
    changes
      .filter((c) => c.kind === 'new' || c.kind === 'modified')
      .map((c) => c.chapterUuid)
  )
  const reorderedCount = changes.filter((c) => c.kind === 'reordered').length
  const removedCount = changes.filter((c) => c.kind === 'removed').length

  if (
    changedUuids.size === 0 &&
    reorderedCount === 0 &&
    removedCount === 0
  ) {
    emit('done')
    return {
      firstRun,
      changes,
      extractedChapters: 0,
      filesWritten: 0,
      filesPreserved: 0,
      tokenUsage,
      durationMs: Date.now() - startTime,
      warnings
    }
  }

  if (options.dryRun) {
    emit('done')
    return {
      firstRun,
      changes,
      extractedChapters: 0,
      filesWritten: 0,
      filesPreserved: 0,
      tokenUsage,
      durationMs: Date.now() - startTime,
      warnings
    }
  }

  const chaptersToReExtract = project.chapters.filter((ch) =>
    changedUuids.has(ch.uuid)
  )

  // Build the priorState for re-extraction: drop contributions for chapters
  // about to be re-extracted (stale) AND any that are no longer in the project.
  const currentUuids = new Set(project.chapters.map((ch) => ch.uuid))
  const priorContributions = (manifest?.chapterContributions ?? []).filter(
    (c) => !changedUuids.has(c.chapterUuid) && currentUuids.has(c.chapterUuid)
  )
  const priorChapterExtractions = (
    manifest?.lastExtractionSnapshot.chapters ?? []
  ).filter((c) => !changedUuids.has(c.chapterUuid) && currentUuids.has(c.chapterUuid))

  const priorRebuild = rebuildMergedState(
    priorContributions,
    priorChapterExtractions,
    project.chapters,
    fieldDefs
  )

  let newContributions: ChapterContribution[] = []
  let newChapterExtractions: ChapterExtraction[] = []

  if (chaptersToReExtract.length > 0) {
    let provider
    try {
      provider = createProvider(providerConfig)
    } catch (err) {
      throw new SyncError(
        `Failed to construct provider: ${(err as Error).message}`,
        'provider',
        err
      )
    }

    emit('extracting', {
      currentChapter: 0,
      totalChangedChapters: chaptersToReExtract.length,
      currentPass: null
    })

    try {
      const result = await reExtractChapters(
        project,
        chaptersToReExtract,
        provider,
        {
          priorState: {
            chapters: priorRebuild.chapters.slice(),
            characters: cloneCharacters(priorRebuild.characters),
            locations: cloneLocations(priorRebuild.locations)
          },
          fieldDefs,
          onProgress: (p) => {
            emit('extracting', {
              currentChapter: p.currentChapter,
              totalChangedChapters: p.totalChapters,
              currentPass: p.currentPass,
              tokensUsedSoFar: p.tokensUsedSoFar,
              estimatedCostSoFar: p.estimatedCostSoFar
            })
          }
        }
      )
      tokenUsage.inputTokens = result.tokenUsage.inputTokens
      tokenUsage.outputTokens = result.tokenUsage.outputTokens
      tokenUsage.estimatedCostUSD = result.tokenUsage.estimatedCostUSD
      newContributions = result.newContributions
      newChapterExtractions = result.newChapterExtractions
      warnings.push(...result.warnings)
    } catch (err) {
      if (err instanceof ExtractionError && err.code === 'provider') {
        throw new SyncError(err.message, 'provider', err)
      }
      throw err
    }
  }

  emit('merging')
  const mergedContributions = mergeContributions(
    manifest?.chapterContributions ?? [],
    newContributions,
    changedUuids,
    currentUuids
  )
  const mergedChapterExtractions = mergeChapterExtractions(
    manifest?.lastExtractionSnapshot.chapters ?? [],
    newChapterExtractions,
    changedUuids,
    currentUuids
  )
  const rebuilt = rebuildMergedState(
    mergedContributions,
    mergedChapterExtractions,
    project.chapters,
    fieldDefs
  )
  warnings.push(...rebuilt.warnings)

  const extractionResult: ExtractionResult = {
    projectName: project.projectName,
    generatedAt: new Date().toISOString(),
    chapters: rebuilt.chapters,
    characters: rebuilt.characters,
    locations: rebuilt.locations,
    timeline: rebuilt.timeline,
    continuityIssues: rebuilt.continuityIssues,
    tokenUsage: {
      inputTokens: (manifest?.cumulativeTokenUsage.inputTokens ?? 0) + tokenUsage.inputTokens,
      outputTokens:
        (manifest?.cumulativeTokenUsage.outputTokens ?? 0) + tokenUsage.outputTokens,
      estimatedCostUSD:
        (manifest?.cumulativeTokenUsage.estimatedCostUSD ?? 0) +
        tokenUsage.estimatedCostUSD
    },
    warnings: [...(manifest?.lastExtractionSnapshot.warnings ?? []), ...warnings],
    chapterContributions: mergedContributions
  }

  emit('regenerating-vault')
  try {
    const vaultResult = await generateVault(
      extractionResult,
      project,
      vaultPath,
      {
        novelTitle: options.novelTitle,
        clean: false,
        genrePresetId: options.genrePresetId,
        characterFields: fieldDefs.customCharacterFields,
        locationFields: fieldDefs.customLocationFields,
        characterSectionLabel: options.characterSectionLabel,
        locationSectionLabel: options.locationSectionLabel
      }
    )
    filesWritten = vaultResult.filesWritten
    filesPreserved = vaultResult.filesPreserved
  } catch (err) {
    throw new SyncError(
      `Vault generation failed: ${(err as Error).message}`,
      'vault',
      err
    )
  }

  emit('writing-manifest')
  const newManifest: SyncManifest = {
    version: 1,
    lastSyncAt: new Date().toISOString(),
    projectName: project.projectName,
    chapters: project.chapters.map(buildManifestEntry),
    chapterContributions: mergedContributions,
    cumulativeTokenUsage: {
      inputTokens:
        (manifest?.cumulativeTokenUsage.inputTokens ?? 0) + tokenUsage.inputTokens,
      outputTokens:
        (manifest?.cumulativeTokenUsage.outputTokens ?? 0) + tokenUsage.outputTokens,
      estimatedCostUSD:
        (manifest?.cumulativeTokenUsage.estimatedCostUSD ?? 0) +
        tokenUsage.estimatedCostUSD
    },
    lastExtractionSnapshot: {
      chapters: mergedChapterExtractions,
      warnings
    }
  }
  await writeManifest(vaultPath, newManifest)

  emit('done')
  return {
    firstRun,
    changes,
    extractedChapters: chaptersToReExtract.length,
    filesWritten,
    filesPreserved,
    tokenUsage,
    durationMs: Date.now() - startTime,
    warnings
  }
}

function buildManifestEntry(chapter: ScrivenerChapter): ManifestChapterEntry {
  return {
    chapterUuid: chapter.uuid,
    chapterOrder: chapter.order,
    chapterTitle: chapter.title,
    chapterHash: hashChapter(chapter),
    sceneHashes: chapter.scenes.map((s) => ({
      uuid: s.uuid,
      hash: s.contentHash
    }))
  }
}

function mergeContributions(
  prior: ChapterContribution[],
  fresh: ChapterContribution[],
  changedUuids: Set<string>,
  currentUuids: Set<string>
): ChapterContribution[] {
  const byUuid = new Map<string, ChapterContribution>()
  for (const entry of prior) {
    if (changedUuids.has(entry.chapterUuid)) continue
    if (!currentUuids.has(entry.chapterUuid)) continue
    byUuid.set(entry.chapterUuid, entry)
  }
  for (const entry of fresh) {
    byUuid.set(entry.chapterUuid, entry)
  }
  return Array.from(byUuid.values())
}

function mergeChapterExtractions(
  prior: ChapterExtraction[],
  fresh: ChapterExtraction[],
  changedUuids: Set<string>,
  currentUuids: Set<string>
): ChapterExtraction[] {
  const byUuid = new Map<string, ChapterExtraction>()
  for (const entry of prior) {
    if (changedUuids.has(entry.chapterUuid)) continue
    if (!currentUuids.has(entry.chapterUuid)) continue
    byUuid.set(entry.chapterUuid, entry)
  }
  for (const entry of fresh) {
    byUuid.set(entry.chapterUuid, entry)
  }
  return Array.from(byUuid.values())
}

function cloneCharacters<T>(items: T[]): T[] {
  return items.map((item) => structuredClone(item))
}

function cloneLocations<T>(items: T[]): T[] {
  return items.map((item) => structuredClone(item))
}
