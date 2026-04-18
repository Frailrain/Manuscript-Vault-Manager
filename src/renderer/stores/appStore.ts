import { create } from 'zustand'

import type {
  AppSettings,
  ChapterChange,
  StoredSettings,
  TokenUsage
} from '../../shared/types'

export const DEFAULT_SETTINGS: AppSettings = {
  scrivenerPath: '',
  vaultPath: '',
  novelTitle: '',
  providerKind: 'anthropic',
  apiKey: '',
  model: 'claude-haiku-4-5-20251001',
  baseURL: '',
  genrePresetId: 'none',
  characterFields: [],
  locationFields: []
}

export type RunMode =
  | 'idle'
  | 'importing'
  | 'syncing'
  | 'completed'
  | 'error'

export interface ProgressSnapshot {
  phase: string
  label: string
  detail: string | null
  currentChapter: number | null
  totalChapters: number | null
  tokensUsedSoFar: number
  estimatedCostSoFar: number
}

export type RunResult =
  | {
      kind: 'import'
      extractedChapters: number
      tokenUsage: TokenUsage
      vaultPath: string
      characterCount: number
      locationCount: number
      timelineEventCount: number
      continuityIssueCount: number
    }
  | {
      kind: 'sync'
      changes: ChapterChange[]
      extractedChapters: number
      tokenUsage: TokenUsage
      vaultPath: string
      regeneratedFiles?: number
    }

export interface AppState {
  activeTab: 'settings' | 'run'
  setActiveTab: (tab: 'settings' | 'run') => void

  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void

  settings: AppSettings
  setSettings: (patch: Partial<AppSettings>) => void
  replaceSettings: (s: AppSettings) => void
  isSettingsDirty: boolean
  markSettingsClean: () => void

  runMode: RunMode
  runProgress: ProgressSnapshot | null
  runResult: RunResult | null
  runError: string | null
  setRunMode: (mode: RunMode) => void
  setRunProgress: (snap: ProgressSnapshot | null) => void
  setRunResult: (result: RunResult | null) => void
  setRunError: (err: string | null) => void
  resetRun: () => void

  hasManifest: boolean
  setHasManifest: (has: boolean) => void
  lastSyncAt: string | null
  lastSyncCost: number | null
  setLastSync: (at: string | null, cost: number | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'settings',
  setActiveTab: (tab) => set({ activeTab: tab }),

  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  settings: { ...DEFAULT_SETTINGS },
  setSettings: (patch) =>
    set((state) => ({
      settings: { ...state.settings, ...patch },
      isSettingsDirty: true
    })),
  replaceSettings: (s) => set({ settings: s, isSettingsDirty: false }),
  isSettingsDirty: false,
  markSettingsClean: () => set({ isSettingsDirty: false }),

  runMode: 'idle',
  runProgress: null,
  runResult: null,
  runError: null,
  setRunMode: (mode) => set({ runMode: mode }),
  setRunProgress: (snap) => set({ runProgress: snap }),
  setRunResult: (result) => set({ runResult: result }),
  setRunError: (err) => set({ runError: err }),
  resetRun: () =>
    set({
      runMode: 'idle',
      runProgress: null,
      runResult: null,
      runError: null
    }),

  hasManifest: false,
  setHasManifest: (has) => set({ hasManifest: has }),
  lastSyncAt: null,
  lastSyncCost: null,
  setLastSync: (at, cost) => set({ lastSyncAt: at, lastSyncCost: cost })
}))

export function splitStoredSettings(stored: StoredSettings): {
  settings: AppSettings
  theme: 'light' | 'dark'
} {
  const { theme, ...rest } = stored
  return { settings: rest, theme }
}
