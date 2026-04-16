import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type {
  ExtractionProgress,
  ExtractionRunPayload,
  ExtractionResult
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
    generate: (payload: unknown) => ipcRenderer.invoke('vault:generate', payload)
  },
  sync: {
    check: (payload: unknown) => ipcRenderer.invoke('sync:check', payload)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value)
  }
}

contextBridge.exposeInMainWorld('mvm', api)

export type MvmApi = typeof api
