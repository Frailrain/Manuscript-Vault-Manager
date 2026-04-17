import { describe, expect, it } from 'vitest'

import {
  translateExtractionProgress,
  translateSyncProgress,
  translateVaultProgress
} from '../progressTranslation'

describe('translateExtractionProgress', () => {
  it('produces "Extracting Chapter X of Y" with pass detail', () => {
    const snap = translateExtractionProgress({
      phase: 'extracting',
      currentChapter: 3,
      totalChapters: 12,
      currentPass: 'characters',
      tokensUsedSoFar: 4000,
      estimatedCostSoFar: 0.12
    })
    expect(snap.label).toBe('Extracting Chapter 3 of 12')
    expect(snap.detail).toBe('Running characters pass')
    expect(snap.currentChapter).toBe(3)
    expect(snap.totalChapters).toBe(12)
    expect(snap.tokensUsedSoFar).toBe(4000)
    expect(snap.estimatedCostSoFar).toBe(0.12)
  })

  it('labels merging phase', () => {
    const snap = translateExtractionProgress({
      phase: 'merging',
      currentChapter: 12,
      totalChapters: 12,
      currentPass: null,
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    expect(snap.label).toBe('Merging results...')
  })

  it('labels preparing phase', () => {
    const snap = translateExtractionProgress({
      phase: 'preparing',
      currentChapter: 0,
      totalChapters: 0,
      currentPass: null,
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    expect(snap.label).toBe('Preparing extraction...')
  })
})

describe('translateSyncProgress', () => {
  it('labels reading-manifest phase', () => {
    const snap = translateSyncProgress({
      phase: 'reading-manifest',
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    expect(snap.label).toBe('Reading last-sync manifest...')
  })

  it('labels diffing phase', () => {
    const snap = translateSyncProgress({
      phase: 'diffing',
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    expect(snap.label).toBe('Comparing against last sync...')
  })

  it('shows "Extracting Chapter 1 of 2" during changed-chapter extraction', () => {
    const snap = translateSyncProgress({
      phase: 'extracting',
      currentChapter: 1,
      totalChangedChapters: 2,
      currentPass: 'timeline',
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    expect(snap.label).toBe('Extracting Chapter 1 of 2')
    expect(snap.detail).toBe('Running timeline pass')
  })

  it('labels regenerating-vault phase', () => {
    const snap = translateSyncProgress({
      phase: 'regenerating-vault',
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    expect(snap.label).toBe('Updating vault files...')
  })

  it('labels writing-manifest phase', () => {
    const snap = translateSyncProgress({
      phase: 'writing-manifest',
      tokensUsedSoFar: 0,
      estimatedCostSoFar: 0
    })
    expect(snap.label).toBe('Saving sync state...')
  })
})

describe('translateVaultProgress', () => {
  it('labels each phase with "Writing vault:"', () => {
    const snap = translateVaultProgress({
      phase: 'characters',
      current: 5,
      total: 10,
      currentFile: 'Elara.md'
    })
    expect(snap.label).toBe('Writing vault: characters...')
    expect(snap.detail).toBe('Elara.md')
    expect(snap.currentChapter).toBe(5)
    expect(snap.totalChapters).toBe(10)
  })

  it('omits determinate counts when total is 0', () => {
    const snap = translateVaultProgress({
      phase: 'dashboard',
      current: 0,
      total: 0,
      currentFile: ''
    })
    expect(snap.currentChapter).toBeNull()
    expect(snap.totalChapters).toBeNull()
    expect(snap.detail).toBeNull()
  })
})
