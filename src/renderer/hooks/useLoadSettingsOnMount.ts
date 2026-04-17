import { useEffect } from 'react'

import { splitStoredSettings, useAppStore } from '../stores/appStore'

export function useLoadSettingsOnMount(): void {
  const replaceSettings = useAppStore((s) => s.replaceSettings)
  const setTheme = useAppStore((s) => s.setTheme)
  const setHasManifest = useAppStore((s) => s.setHasManifest)
  const setLastSync = useAppStore((s) => s.setLastSync)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const stored = await window.mvm.settings.getAll()
        if (cancelled) return
        const { settings, theme } = splitStoredSettings(stored)
        replaceSettings(settings)
        setTheme(theme)
        if (settings.vaultPath) {
          try {
            const has = await window.mvm.vault.hasManifest(settings.vaultPath)
            if (cancelled) return
            setHasManifest(has)
            if (has) {
              const summary = await window.mvm.vault.readManifestSummary(
                settings.vaultPath
              )
              if (cancelled) return
              if (summary) {
                setLastSync(
                  summary.lastSyncAt,
                  summary.cumulativeTokenUsage.estimatedCostUSD
                )
              }
            }
          } catch {
            // Non-fatal: leave manifest flags default.
          }
        }
      } catch {
        // First-launch or IPC error: leave defaults.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [replaceSettings, setTheme, setHasManifest, setLastSync])
}
