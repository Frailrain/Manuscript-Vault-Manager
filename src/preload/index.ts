import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type {
  ExtractionProgress,
  ExtractionRunPayload,
  ExtractionResult,
  ManifestSummary,
  StoredSettings,
  SyncManifest,
  SyncProgress,
  SyncResult,
  SyncRunPayload,
  VaultGenerateRunPayload,
  VaultGenerationResult,
  VaultProgress,
  WriteInitialManifestPayload
} from '../shared/types'

const api = {
  scrivener: {
    parse: (path: string) => ipcRenderer.invoke('scrivener:parse', path)
  },
  extraction: {
    run: (payload: ExtractionRunPayload): Promise<ExtractionResult> =>
      ipcRenderer.invoke('extraction:run', payload) as Promise<ExtractionResult>,
    onProgress: (cb: (progress: ExtractionProgress) => void) => {
      const listener = (_event: IpcRendererEvent, progress: ExtractionProgress) =>
        cb(progress)
      ipcRenderer.on('extraction:progress', listener)
      return () => {
        ipcRenderer.off('extraction:progress', listener)
      }
    }
  },
  vault: {
    generate: (payload: VaultGenerateRunPayload): Promise<VaultGenerationResult> =>
      ipcRenderer.invoke('vault:generate', payload) as Promise<VaultGenerationResult>,
    onProgress: (cb: (progress: VaultProgress) => void) => {
      const listener = (_event: IpcRendererEvent, progress: VaultProgress) =>
        cb(progress)
      ipcRenderer.on('vault:progress', listener)
      return () => {
        ipcRenderer.off('vault:progress', listener)
      }
    },
    hasManifest: (vaultPath: string): Promise<boolean> =>
      ipcRenderer.invoke('vault:hasManifest', vaultPath) as Promise<boolean>,
    readManifestSummary: (vaultPath: string): Promise<ManifestSummary | null> =>
      ipcRenderer.invoke(
        'vault:readManifestSummary',
        vaultPath
      ) as Promise<ManifestSummary | null>
  },
  sync: {
    run: (payload: SyncRunPayload): Promise<SyncResult> =>
      ipcRenderer.invoke('sync:run', payload) as Promise<SyncResult>,
    onProgress: (cb: (progress: SyncProgress) => void) => {
      const listener = (_event: IpcRendererEvent, progress: SyncProgress) =>
        cb(progress)
      ipcRenderer.on('sync:progress', listener)
      return () => {
        ipcRenderer.off('sync:progress', listener)
      }
    },
    writeInitialManifest: (
      payload: WriteInitialManifestPayload
    ): Promise<SyncManifest> =>
      ipcRenderer.invoke(
        'sync:writeInitialManifest',
        payload
      ) as Promise<SyncManifest>
  },
  settings: {
    getAll: (): Promise<StoredSettings> =>
      ipcRenderer.invoke('settings:get') as Promise<StoredSettings>,
    update: (patch: Partial<StoredSettings>): Promise<StoredSettings> =>
      ipcRenderer.invoke('settings:set', patch) as Promise<StoredSettings>
  },
  dialogs: {
    pickScrivener: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:pickScrivener') as Promise<string | null>,
    pickVault: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:pickVault') as Promise<string | null>
  },
  shell: {
    openVault: (
      vaultPath: string
    ): Promise<{ opened: 'obsidian' | 'folder' }> =>
      ipcRenderer.invoke('shell:openVault', vaultPath) as Promise<{
        opened: 'obsidian' | 'folder'
      }>
  }
}

contextBridge.exposeInMainWorld('mvm', api)

export type MvmApi = typeof api
