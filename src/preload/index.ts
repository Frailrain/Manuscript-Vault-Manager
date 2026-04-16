import { contextBridge, ipcRenderer } from 'electron'

const api = {
  scrivener: {
    parse: (path: string) => ipcRenderer.invoke('scrivener:parse', path)
  },
  extraction: {
    run: (payload: unknown) => ipcRenderer.invoke('extraction:run', payload)
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
