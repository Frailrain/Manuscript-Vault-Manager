import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    title: 'Manuscript Vault Manager',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  registerIpcHandlers()

  mainWindow = createWindow()

  createTray({
    getWindow: () => mainWindow,
    quit: () => {
      isQuitting = true
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  // Intentional: app remains alive in the tray.
})

app.on('before-quit', () => {
  isQuitting = true
})
