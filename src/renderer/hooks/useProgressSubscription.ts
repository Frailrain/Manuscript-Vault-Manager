import { useEffect } from 'react'

import {
  translateExtractionProgress,
  translateSyncProgress,
  translateVaultProgress
} from '../lib/progressTranslation'
import { useAppStore } from '../stores/appStore'

export function useProgressSubscription(): void {
  const setRunProgress = useAppStore((s) => s.setRunProgress)
  useEffect(() => {
    const offExtraction = window.mvm.extraction.onProgress((p) => {
      setRunProgress(translateExtractionProgress(p))
    })
    const offSync = window.mvm.sync.onProgress((p) => {
      setRunProgress(translateSyncProgress(p))
    })
    const offVault = window.mvm.vault.onProgress((p) => {
      setRunProgress(translateVaultProgress(p))
    })
    return () => {
      offExtraction()
      offSync()
      offVault()
    }
  }, [setRunProgress])
}
