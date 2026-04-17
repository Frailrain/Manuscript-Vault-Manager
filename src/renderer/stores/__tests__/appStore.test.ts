import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS,
  splitStoredSettings,
  useAppStore
} from '../appStore'
import type { StoredSettings } from '../../../shared/types'

beforeEach(() => {
  useAppStore.setState({
    activeTab: 'settings',
    theme: 'dark',
    settings: { ...DEFAULT_SETTINGS },
    isSettingsDirty: false,
    runMode: 'idle',
    runProgress: null,
    runResult: null,
    runError: null,
    hasManifest: false,
    lastSyncAt: null,
    lastSyncCost: null
  })
})

describe('appStore', () => {
  it('marks settings dirty when a field is edited', () => {
    useAppStore.getState().setSettings({ novelTitle: 'My Novel' })
    expect(useAppStore.getState().settings.novelTitle).toBe('My Novel')
    expect(useAppStore.getState().isSettingsDirty).toBe(true)
  })

  it('clears dirty flag via markSettingsClean', () => {
    useAppStore.getState().setSettings({ novelTitle: 'X' })
    expect(useAppStore.getState().isSettingsDirty).toBe(true)
    useAppStore.getState().markSettingsClean()
    expect(useAppStore.getState().isSettingsDirty).toBe(false)
  })

  it('replaceSettings overwrites and clears dirty flag', () => {
    useAppStore.getState().setSettings({ novelTitle: 'Dirty' })
    useAppStore
      .getState()
      .replaceSettings({ ...DEFAULT_SETTINGS, apiKey: 'k' })
    expect(useAppStore.getState().settings.novelTitle).toBe('')
    expect(useAppStore.getState().settings.apiKey).toBe('k')
    expect(useAppStore.getState().isSettingsDirty).toBe(false)
  })

  it('run mode transitions: idle → importing → completed', () => {
    const { setRunMode, setRunResult } = useAppStore.getState()
    setRunMode('importing')
    expect(useAppStore.getState().runMode).toBe('importing')
    setRunResult({
      kind: 'import',
      extractedChapters: 3,
      tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 },
      vaultPath: '/tmp/v',
      characterCount: 1,
      locationCount: 1,
      timelineEventCount: 1,
      continuityIssueCount: 0
    })
    setRunMode('completed')
    expect(useAppStore.getState().runMode).toBe('completed')
    expect(useAppStore.getState().runResult?.kind).toBe('import')
  })

  it('resetRun clears progress/result/error and returns to idle', () => {
    const store = useAppStore.getState()
    store.setRunMode('error')
    store.setRunError('boom')
    store.setRunProgress({
      phase: 'extracting',
      label: 'x',
      detail: null,
      currentChapter: 1,
      totalChapters: 3,
      tokensUsedSoFar: 10,
      estimatedCostSoFar: 0.01
    })
    store.resetRun()
    const after = useAppStore.getState()
    expect(after.runMode).toBe('idle')
    expect(after.runProgress).toBeNull()
    expect(after.runError).toBeNull()
    expect(after.runResult).toBeNull()
  })

  it('setActiveTab switches between tabs', () => {
    useAppStore.getState().setActiveTab('run')
    expect(useAppStore.getState().activeTab).toBe('run')
    useAppStore.getState().setActiveTab('settings')
    expect(useAppStore.getState().activeTab).toBe('settings')
  })

  it('splitStoredSettings separates theme from app settings', () => {
    const stored: StoredSettings = {
      ...DEFAULT_SETTINGS,
      novelTitle: 'X',
      theme: 'light'
    }
    const { settings, theme } = splitStoredSettings(stored)
    expect(theme).toBe('light')
    expect(settings.novelTitle).toBe('X')
    expect('theme' in settings).toBe(false)
  })
})
