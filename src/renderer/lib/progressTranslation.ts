import type {
  ExtractionProgress,
  SyncProgress,
  VaultProgress
} from '../../shared/types'
import type { ProgressSnapshot } from '../stores/appStore'

export function translateExtractionProgress(
  p: ExtractionProgress
): ProgressSnapshot {
  let label: string
  let detail: string | null = null
  switch (p.phase) {
    case 'preparing':
      label = 'Preparing extraction...'
      break
    case 'extracting':
      label = `Extracting Chapter ${p.currentChapter} of ${p.totalChapters}`
      detail = p.currentPass ? `Running ${p.currentPass} pass` : null
      break
    case 'merging':
      label = 'Merging results...'
      break
    case 'done':
      label = 'Extraction complete'
      break
    default:
      label = `Phase: ${p.phase}`
  }
  return {
    phase: p.phase,
    label,
    detail,
    currentChapter: p.currentChapter ?? null,
    totalChapters: p.totalChapters ?? null,
    tokensUsedSoFar: p.tokensUsedSoFar ?? 0,
    estimatedCostSoFar: p.estimatedCostSoFar ?? 0
  }
}

export function translateSyncProgress(p: SyncProgress): ProgressSnapshot {
  let label: string
  let detail: string | null = null
  switch (p.phase) {
    case 'reading-manifest':
      label = 'Reading last-sync manifest...'
      break
    case 'diffing':
      label = 'Comparing against last sync...'
      break
    case 'extracting':
      if (p.currentChapter && p.totalChangedChapters) {
        label = `Extracting Chapter ${p.currentChapter} of ${p.totalChangedChapters}`
      } else {
        label = 'Extracting changed chapters...'
      }
      detail = p.currentPass ? `Running ${p.currentPass} pass` : null
      break
    case 'merging':
      label = 'Merging results...'
      break
    case 'regenerating-vault':
      label = 'Updating vault files...'
      break
    case 'writing-manifest':
      label = 'Saving sync state...'
      break
    case 'done':
      label = 'Sync complete'
      break
    default:
      label = `Phase: ${p.phase}`
  }
  return {
    phase: p.phase,
    label,
    detail,
    currentChapter: p.currentChapter ?? null,
    totalChapters: p.totalChangedChapters ?? null,
    tokensUsedSoFar: p.tokensUsedSoFar ?? 0,
    estimatedCostSoFar: p.estimatedCostSoFar ?? 0
  }
}

export function translateVaultProgress(p: VaultProgress): ProgressSnapshot {
  const label = `Writing vault: ${p.phase}...`
  return {
    phase: p.phase,
    label,
    detail: p.currentFile ? p.currentFile : null,
    currentChapter: p.total > 0 ? p.current : null,
    totalChapters: p.total > 0 ? p.total : null,
    tokensUsedSoFar: 0,
    estimatedCostSoFar: 0
  }
}
