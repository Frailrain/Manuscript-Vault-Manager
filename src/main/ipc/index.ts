import { ipcMain } from 'electron'

import { runExtraction } from '../../core/extraction'
import { parseScrivenerProject } from '../../core/scrivener'
import { generateVault } from '../../core/vault'
import type {
  ExtractionProgress,
  ExtractionRunPayload,
  VaultGenerateRunPayload,
  VaultProgress
} from '../../shared/types'

const STUB_CHANNELS = [
  'sync:check',
  'settings:get',
  'settings:set'
] as const

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
        // Stream plain-data progress to the renderer; no object refs leak.
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

  for (const channel of STUB_CHANNELS) {
    ipcMain.handle(channel, async () => {
      throw new Error(`[mvm] IPC channel '${channel}' is not yet implemented`)
    })
  }
}
