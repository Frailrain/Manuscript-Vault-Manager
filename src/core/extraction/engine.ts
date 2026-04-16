import type {
  ChapterContribution,
  ChapterExtraction,
  ContinuityIssue,
  ContinuityIssueDelta,
  ContinuitySeverity,
  ExtractedCharacter,
  ExtractedCharacterDelta,
  ExtractedLocation,
  ExtractedLocationDelta,
  ExtractionPass,
  ExtractionProgress,
  ExtractionResult,
  LLMProviderConfig,
  ScrivenerChapter,
  ScrivenerProject,
  TimelineEvent,
  TimelineEventDelta,
  TokenUsage
} from '../../shared/types'
import { chapterFitsInOneCall } from './chunking'
import { estimateCost, hasKnownPricing } from './costs'
import { ExtractionError } from './errors'
import {
  appendChapterExtraction,
  dedupeByNormalizedName,
  mergeCharacters,
  mergeContinuity,
  mergeLocations,
  mergeTimeline,
  sortTimeline
} from './merge'
import {
  charactersPass,
  continuityPass,
  locationsPass,
  timelinePass,
  type ExtractionContext,
  type PassRunner
} from './passes'
import { createProvider, LLMProviderError, type LLMProvider } from './providers'

const RECENT_SUMMARY_WINDOW = 10
const DETAILED_CHARACTER_WINDOW = 20

export interface RunExtractionOptions {
  onProgress?: (progress: ExtractionProgress) => void
  continueOnError?: boolean
}

export async function runExtraction(
  project: ScrivenerProject,
  providerConfig: LLMProviderConfig,
  options: RunExtractionOptions = {}
): Promise<ExtractionResult> {
  let provider: LLMProvider
  try {
    provider = createProvider(providerConfig)
  } catch (err) {
    if (err instanceof ExtractionError) throw err
    throw new ExtractionError(
      `Failed to construct provider: ${(err as Error).message}`,
      'config',
      err
    )
  }
  return runExtractionWithProvider(project, provider, options)
}

export async function runExtractionWithProvider(
  project: ScrivenerProject,
  provider: LLMProvider,
  options: RunExtractionOptions = {}
): Promise<ExtractionResult> {
  const onProgress = options.onProgress ?? noop
  const warnings: string[] = []

  const chapters: ChapterExtraction[] = []
  const characters: ExtractedCharacter[] = []
  const locations: ExtractedLocation[] = []
  const timeline: TimelineEvent[] = []
  const continuityIssues: ContinuityIssue[] = []
  const chapterContributions: ChapterContribution[] = []
  const tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUSD: 0
  }

  if (!hasKnownPricing(provider.model)) {
    warnings.push(
      `Cost estimate unavailable for model '${provider.model}'. Token usage will still be tracked.`
    )
  }

  onProgress({
    phase: 'preparing',
    currentChapter: 0,
    totalChapters: project.chapters.length,
    currentPass: null,
    tokensUsedSoFar: 0,
    estimatedCostSoFar: 0
  })

  if (project.chapters.length === 0) {
    warnings.push('Project contains no chapters; returning an empty extraction.')
    onProgress({
      phase: 'done',
      currentChapter: 0,
      totalChapters: 0,
      currentPass: null,
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    return {
      projectName: project.projectName,
      generatedAt: new Date().toISOString(),
      chapters,
      characters,
      locations,
      timeline,
      continuityIssues,
      tokenUsage,
      warnings,
      chapterContributions
    }
  }

  try {
    for (let i = 0; i < project.chapters.length; i++) {
      const chapter = project.chapters[i]!
      const ctx = buildContext(project, chapters, characters, locations, chapter)

      const emitProgress = (pass: ExtractionPass | null): void => {
        onProgress({
          phase: 'extracting',
          currentChapter: i + 1,
          totalChapters: project.chapters.length,
          currentPass: pass,
          tokensUsedSoFar: tokenUsage.inputTokens + tokenUsage.outputTokens,
          estimatedCostSoFar: tokenUsage.estimatedCostUSD
        })
      }

      emitProgress(null)

      const chapterExtraction: ChapterExtraction = {
        chapterOrder: chapter.order,
        chapterUuid: chapter.uuid,
        chapterTitle: chapter.title,
        summary: '',
        charactersAppearing: [],
        locationsAppearing: []
      }
      const characterDeltas: ExtractedCharacterDelta[] = []
      const locationDeltas: ExtractedLocationDelta[] = []
      const timelineDeltas: TimelineEventDelta[] = []
      const continuityDeltas: ContinuityIssueDelta[] = []
      const passErrors: Partial<Record<ExtractionPass, string>> = {}

      const fits = chapterFitsInOneCall(chapter)

      if (fits) {
        await runPass(
          charactersPass,
          chapter,
          ctx,
          provider,
          tokenUsage,
          passErrors,
          emitProgress,
          (data) => {
            characterDeltas.push(...data.characters)
            mergeCharacters(characters, data.characters, chapter.order)
          }
        )
        await runPass(
          locationsPass,
          chapter,
          ctx,
          provider,
          tokenUsage,
          passErrors,
          emitProgress,
          (data) => {
            locationDeltas.push(...data.locations)
            mergeLocations(locations, data.locations, chapter.order)
          }
        )
        await runPass(
          timelinePass,
          chapter,
          ctx,
          provider,
          tokenUsage,
          passErrors,
          emitProgress,
          (data) => {
            timelineDeltas.push(...data.events)
            mergeTimeline(timeline, data.events, chapter.order)
            chapterExtraction.summary = data.summary
            chapterExtraction.charactersAppearing = data.charactersAppearing
            chapterExtraction.locationsAppearing = data.locationsAppearing
          }
        )
        await runPass(
          continuityPass,
          chapter,
          ctx,
          provider,
          tokenUsage,
          passErrors,
          emitProgress,
          (data) => {
            continuityDeltas.push(...data.issues)
            mergeContinuity(continuityIssues, data.issues, chapter.order)
          }
        )
      } else {
        warnings.push(
          `Chapter ${chapter.order} "${chapter.title}" exceeds one-call size budget; running per-scene fallback.`
        )
        await runChapterInPieces(
          chapter,
          ctx,
          provider,
          tokenUsage,
          passErrors,
          emitProgress,
          chapterExtraction,
          characters,
          locations,
          timeline,
          continuityIssues,
          characterDeltas,
          locationDeltas,
          timelineDeltas,
          continuityDeltas
        )
      }

      if (Object.keys(passErrors).length > 0) {
        chapterExtraction.passErrors = passErrors
        for (const [pass, msg] of Object.entries(passErrors)) {
          warnings.push(`Chapter ${chapter.order} pass '${pass}' failed: ${msg}`)
        }
      }

      const allFailed =
        (['characters', 'locations', 'timeline', 'continuity'] as ExtractionPass[]).every(
          (p) => passErrors[p] !== undefined
        )
      if (allFailed) {
        warnings.push(
          `Chapter ${chapter.order} "${chapter.title}" failed every pass; skipping.`
        )
        continue
      }

      appendChapterExtraction(chapters, chapterExtraction)
      chapterContributions.push({
        chapterOrder: chapter.order,
        chapterUuid: chapter.uuid,
        characterDeltas: dedupeByNormalizedName(characterDeltas),
        locationDeltas: dedupeByNormalizedName(locationDeltas),
        timelineEvents: timelineDeltas,
        continuityIssues: continuityDeltas
      })
      tokenUsage.estimatedCostUSD = estimateCost(
        provider.model,
        tokenUsage.inputTokens,
        tokenUsage.outputTokens
      )
    }
  } catch (err) {
    if (err instanceof LLMProviderError && err.kind === 'auth') {
      throw new ExtractionError(
        `Provider rejected credentials — stopping extraction. ${err.message}`,
        'provider',
        err
      )
    }
    throw err
  }

  onProgress({
    phase: 'merging',
    currentChapter: project.chapters.length,
    totalChapters: project.chapters.length,
    currentPass: null,
    tokensUsedSoFar: tokenUsage.inputTokens + tokenUsage.outputTokens,
    estimatedCostSoFar: tokenUsage.estimatedCostUSD
  })

  const sortedTimeline = sortTimeline(timeline)

  onProgress({
    phase: 'done',
    currentChapter: project.chapters.length,
    totalChapters: project.chapters.length,
    currentPass: null,
    tokensUsedSoFar: tokenUsage.inputTokens + tokenUsage.outputTokens,
    estimatedCostSoFar: tokenUsage.estimatedCostUSD
  })

  return {
    projectName: project.projectName,
    generatedAt: new Date().toISOString(),
    chapters,
    characters,
    locations,
    timeline: sortedTimeline,
    continuityIssues: normaliseContinuityChapters(continuityIssues),
    tokenUsage,
    warnings,
    chapterContributions
  }
}

async function runPass<T>(
  pass: PassRunner<T>,
  chapter: ScrivenerChapter,
  ctx: ExtractionContext,
  provider: LLMProvider,
  tokenUsage: TokenUsage,
  passErrors: Partial<Record<ExtractionPass, string>>,
  emitProgress: (pass: ExtractionPass | null) => void,
  onSuccess: (data: T) => void
): Promise<void> {
  emitProgress(pass.name)
  const prompts = pass.buildPrompts(chapter, ctx)
  try {
    const result = await provider.callWithSchema<unknown>({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      toolName: pass.toolName,
      toolDescription: pass.toolDescription,
      toolInputSchema: pass.schema
    })
    tokenUsage.inputTokens += result.usage.inputTokens
    tokenUsage.outputTokens += result.usage.outputTokens
    const validated = pass.validate(result.data)
    onSuccess(validated)
  } catch (err) {
    // Auth errors are unrecoverable — rethrow so the caller can bail.
    if (err instanceof LLMProviderError && err.kind === 'auth') throw err
    const message =
      err instanceof Error ? err.message : `Unknown error running pass '${pass.name}'`
    passErrors[pass.name] = message
  }
}

async function runChapterInPieces(
  chapter: ScrivenerChapter,
  ctx: ExtractionContext,
  provider: LLMProvider,
  tokenUsage: TokenUsage,
  passErrors: Partial<Record<ExtractionPass, string>>,
  emitProgress: (pass: ExtractionPass | null) => void,
  chapterExtraction: ChapterExtraction,
  characters: ExtractedCharacter[],
  locations: ExtractedLocation[],
  timeline: TimelineEvent[],
  continuityIssues: ContinuityIssue[],
  characterDeltas: ExtractedCharacterDelta[],
  locationDeltas: ExtractedLocationDelta[],
  timelineDeltas: TimelineEventDelta[],
  continuityDeltas: ContinuityIssueDelta[]
): Promise<void> {
  const sceneSummaries: string[] = []
  const charSet = new Set<string>()
  const locSet = new Set<string>()
  let sceneSequence = 1

  for (const scene of chapter.scenes) {
    if (!scene.content.trim()) continue

    const syntheticChapter: ScrivenerChapter = {
      ...chapter,
      scenes: [scene]
    }

    await runPass(
      charactersPass,
      syntheticChapter,
      ctx,
      provider,
      tokenUsage,
      passErrors,
      emitProgress,
      (data) => {
        characterDeltas.push(...data.characters)
        mergeCharacters(characters, data.characters, chapter.order)
      }
    )
    await runPass(
      locationsPass,
      syntheticChapter,
      ctx,
      provider,
      tokenUsage,
      passErrors,
      emitProgress,
      (data) => {
        locationDeltas.push(...data.locations)
        mergeLocations(locations, data.locations, chapter.order)
      }
    )
    await runPass(
      timelinePass,
      syntheticChapter,
      ctx,
      provider,
      tokenUsage,
      passErrors,
      emitProgress,
      (data) => {
        for (const ev of data.events) {
          const seq = sceneSequence++
          timeline.push({
            chapterOrder: chapter.order,
            summary: ev.summary,
            sequence: seq
          })
          timelineDeltas.push({ summary: ev.summary, sequence: seq })
        }
        sceneSummaries.push(data.summary)
        for (const name of data.charactersAppearing) charSet.add(name)
        for (const name of data.locationsAppearing) locSet.add(name)
      }
    )
    await runPass(
      continuityPass,
      syntheticChapter,
      ctx,
      provider,
      tokenUsage,
      passErrors,
      emitProgress,
      (data) => {
        continuityDeltas.push(...data.issues)
        mergeContinuity(continuityIssues, data.issues, chapter.order)
      }
    )
  }

  chapterExtraction.summary = sceneSummaries.join(' ').trim()
  chapterExtraction.charactersAppearing = Array.from(charSet)
  chapterExtraction.locationsAppearing = Array.from(locSet)
}

function buildContext(
  project: ScrivenerProject,
  priorChapterExtractions: ChapterExtraction[],
  characters: ExtractedCharacter[],
  locations: ExtractedLocation[],
  currentChapter: ScrivenerChapter
): ExtractionContext {
  const priorCharacters = characters.map((c) => ({
    name: c.name,
    aliases: c.aliases,
    role: c.role
  }))
  const detailedStart = Math.max(0, characters.length - DETAILED_CHARACTER_WINDOW)
  const priorCharactersDetailed = characters.slice(detailedStart).map((c) => ({
    name: c.name,
    aliases: c.aliases,
    description: c.description,
    role: c.role
  }))
  const priorLocations = locations.map((l) => ({
    name: l.name,
    description: truncate(l.description, 160)
  }))
  const recentStart = Math.max(
    0,
    priorChapterExtractions.length - RECENT_SUMMARY_WINDOW
  )
  const priorChapterSummaries = priorChapterExtractions
    .slice(recentStart)
    .map((ch) => ({
      order: ch.chapterOrder,
      title: ch.chapterTitle,
      summary: ch.summary
    }))
  const priorChapterHeadlines = priorChapterExtractions
    .slice(0, recentStart)
    .map((ch) => ({ order: ch.chapterOrder, title: ch.chapterTitle }))

  return {
    projectName: project.projectName,
    priorCharacters,
    priorCharactersDetailed,
    priorLocations,
    priorChapterSummaries,
    priorChapterHeadlines,
    currentChapterOrder: currentChapter.order,
    totalChapters: project.chapters.length
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + '…'
}

function normaliseContinuityChapters(
  issues: ContinuityIssue[]
): ContinuityIssue[] {
  return issues.map((i) => ({
    severity: i.severity as ContinuitySeverity,
    description: i.description,
    chapters: i.chapters,
    suggestion: i.suggestion
  }))
}

function noop(): void {}
