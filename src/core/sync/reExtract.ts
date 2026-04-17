import type {
  ChapterContribution,
  ChapterExtraction,
  ExtractedCharacter,
  ExtractedLocation,
  ExtractionPass,
  ScrivenerChapter,
  ScrivenerProject,
  TokenUsage
} from '../../shared/types'
import { estimateCost } from '../extraction/costs'
import { ExtractionError } from '../extraction/errors'
import { extractSingleChapter } from '../extraction/engine'
import { LLMProviderError, type LLMProvider } from '../extraction/providers'

export interface ReExtractPriorState {
  chapters: ChapterExtraction[]
  characters: ExtractedCharacter[]
  locations: ExtractedLocation[]
}

export interface ReExtractProgress {
  currentChapter: number
  totalChapters: number
  currentPass: ExtractionPass | null
  tokensUsedSoFar: number
  estimatedCostSoFar: number
}

export interface ReExtractOptions {
  priorState: ReExtractPriorState
  onProgress?: (progress: ReExtractProgress) => void
}

export interface ReExtractResult {
  newContributions: ChapterContribution[]
  newChapterExtractions: ChapterExtraction[]
  tokenUsage: TokenUsage
  warnings: string[]
}

/**
 * Re-run extraction on a subset of chapters, carrying the supplied
 * priorState as the evolving context. Chapters are processed in order by
 * `chapter.order`. The priorState is mutated in-place so each subsequent
 * chapter sees the merged characters/locations contributed by the previous
 * one.
 */
export async function reExtractChapters(
  project: ScrivenerProject,
  chaptersToExtract: ScrivenerChapter[],
  provider: LLMProvider,
  options: ReExtractOptions
): Promise<ReExtractResult> {
  const warnings: string[] = []
  const newContributions: ChapterContribution[] = []
  const newChapterExtractions: ChapterExtraction[] = []
  const tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUSD: 0
  }

  const ordered = chaptersToExtract
    .slice()
    .sort((a, b) => a.order - b.order)

  try {
    for (let i = 0; i < ordered.length; i++) {
      const chapter = ordered[i]!
      const emitPass = (pass: ExtractionPass | null): void => {
        options.onProgress?.({
          currentChapter: i + 1,
          totalChapters: ordered.length,
          currentPass: pass,
          tokensUsedSoFar: tokenUsage.inputTokens + tokenUsage.outputTokens,
          estimatedCostSoFar: tokenUsage.estimatedCostUSD
        })
      }
      emitPass(null)

      const outcome = await extractSingleChapter(
        project,
        chapter,
        provider,
        options.priorState,
        tokenUsage,
        { emitPass }
      )
      warnings.push(...outcome.chapterWarnings)
      if (outcome.skipped) continue
      newContributions.push(outcome.contribution)
      newChapterExtractions.push(outcome.chapterExtraction)
      tokenUsage.estimatedCostUSD = estimateCost(
        provider.model,
        tokenUsage.inputTokens,
        tokenUsage.outputTokens
      )
    }
  } catch (err) {
    if (err instanceof LLMProviderError && err.kind === 'auth') {
      throw new ExtractionError(
        `Provider rejected credentials — stopping re-extraction. ${err.message}`,
        'provider',
        err
      )
    }
    throw err
  }

  return { newContributions, newChapterExtractions, tokenUsage, warnings }
}
