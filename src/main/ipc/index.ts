import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'

import { runExtraction } from '../../core/extraction'
import { parseScrivenerProject } from '../../core/scrivener'
import {
  buildManifestFromExtraction,
  readManifest,
  syncProject,
  writeManifest
} from '../../core/sync'
import { generateVault } from '../../core/vault'
import type {
  ExtractionProgress,
  ExtractionRunPayload,
  ManifestSummary,
  StoredSettings,
  SyncProgress,
  SyncRunPayload,
  VaultGenerateRunPayload,
  VaultProgress,
  WriteInitialManifestPayload
} from '../../shared/types'
import { getAllSettings, setAllSettings } from '../settings'

export function registerIpcHandlers(): void {
  ipcMain.handle('scrivener:parse', async (_event, projectPath: unknown) => {
    if (typeof projectPath !== 'string' || projectPath.length === 0) {
      throw new Error('[scrivener:parse] projectPath must be a non-empty string')
    }
    return parseScrivenerProject(projectPath)
  })

  ipcMain.handle('extraction:run', async (event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('[extraction:run] payload must be an object')
    }
    const { project, provider } = payload as Partial<ExtractionRunPayload>
    if (!project || !provider) {
      throw new Error(
        '[extraction:run] payload must include { project, provider }'
      )
    }
    return runExtraction(project, provider, {
      onProgress: (progress: ExtractionProgress) => {
        event.sender.send('extraction:progress', progress)
      }
    })
  })

  ipcMain.handle('vault:generate', async (event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('[vault:generate] payload must be an object')
    }
    const { extraction, scrivenerProject, vaultPath, options } =
      payload as Partial<VaultGenerateRunPayload>
    if (!extraction || !scrivenerProject || !vaultPath || !options) {
      throw new Error(
        '[vault:generate] payload must include { extraction, scrivenerProject, vaultPath, options }'
      )
    }
    return generateVault(extraction, scrivenerProject, vaultPath, {
      ...options,
      onProgress: (progress: VaultProgress) => {
        event.sender.send('vault:progress', progress)
      }
    })
  })

  ipcMain.handle('vault:hasManifest', (_event, vaultPath: unknown) => {
    if (typeof vaultPath !== 'string' || vaultPath.length === 0) return false
    return existsSync(join(vaultPath, '_meta', 'manifest.json'))
  })

  ipcMain.handle(
    'vault:readManifestSummary',
    async (_event, vaultPath: unknown): Promise<ManifestSummary | null> => {
      if (typeof vaultPath !== 'string' || vaultPath.length === 0) return null
      try {
        const manifest = await readManifest(vaultPath)
        if (!manifest) return null
        return {
          lastSyncAt: manifest.lastSyncAt,
          cumulativeTokenUsage: manifest.cumulativeTokenUsage
        }
      } catch {
        return null
      }
    }
  )

  ipcMain.handle('sync:run', async (event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('[sync:run] payload must be an object')
    }
    const { project, vaultPath, providerConfig, options } =
      payload as Partial<SyncRunPayload>
    if (!project || !vaultPath || !providerConfig || !options) {
      throw new Error(
        '[sync:run] payload must include { project, vaultPath, providerConfig, options }'
      )
    }
    return syncProject(project, vaultPath, providerConfig, {
      ...options,
      onProgress: (progress: SyncProgress) => {
        event.sender.send('sync:progress', progress)
      }
    })
  })

  ipcMain.handle('sync:writeInitialManifest', async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('[sync:writeInitialManifest] payload must be an object')
    }
    const { project, extraction, vaultPath } =
      payload as Partial<WriteInitialManifestPayload>
    if (!project || !extraction || !vaultPath) {
      throw new Error(
        '[sync:writeInitialManifest] payload must include { project, extraction, vaultPath }'
      )
    }
    const manifest = buildManifestFromExtraction(project, extraction)
    await writeManifest(vaultPath, manifest)
    return manifest
  })

  ipcMain.handle('settings:get', () => getAllSettings())
  ipcMain.handle('settings:set', (_event, patch: unknown) => {
    if (!patch || typeof patch !== 'object') {
      throw new Error('[settings:set] patch must be an object')
    }
    return setAllSettings(patch as Partial<StoredSettings>)
  })

  ipcMain.handle('dialog:pickScrivener', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Scrivener Project',
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Scrivener Project', extensions: ['scriv', 'scrivx'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('dialog:pickVault', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title:
        'Select Vault Folder (or choose an empty folder to create a new vault)',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('shell:openVault', async (_event, vaultPath: unknown) => {
    if (typeof vaultPath !== 'string' || vaultPath.length === 0) {
      throw new Error('[shell:openVault] vaultPath required')
    }
    const vaultName = basename(vaultPath)
    const obsidianUrl = `obsidian://open?vault=${encodeURIComponent(
      vaultName
    )}&path=${encodeURIComponent(vaultPath)}`
    try {
      await shell.openExternal(obsidianUrl)
      return { opened: 'obsidian' as const }
    } catch {
      const err = await shell.openPath(vaultPath)
      if (err) {
        throw new Error(`Failed to open vault folder: ${err}`)
      }
      return { opened: 'folder' as const }
    }
  })
}
