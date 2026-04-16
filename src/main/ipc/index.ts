import { ipcMain } from 'electron'

import { parseScrivenerProject } from '../../core/scrivener'

const STUB_CHANNELS = [
  'extraction:run',
  'vault:generate',
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

  for (const channel of STUB_CHANNELS) {
    ipcMain.handle(channel, async () => {
      throw new Error(`[mvm] IPC channel '${channel}' is not yet implemented`)
    })
  }
}
