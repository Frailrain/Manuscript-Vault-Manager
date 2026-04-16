import { BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'

interface TrayOptions {
  getWindow: () => BrowserWindow | null
  quit: () => void
}

let tray: Tray | null = null

export function createTray(options: TrayOptions): Tray {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const sourceImage = nativeImage.createFromPath(iconPath)
  const trayImage = sourceImage.isEmpty()
    ? nativeImage.createEmpty()
    : sourceImage.resize({ width: 16, height: 16 })

  tray = new Tray(trayImage)

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => showWindow(options.getWindow())
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => options.quit()
    }
  ])

  tray.setToolTip('Manuscript Vault Manager')
  tray.setContextMenu(menu)
  tray.on('click', () => toggleWindow(options.getWindow()))

  return tray
}

function showWindow(window: BrowserWindow | null): void {
  if (!window) return
  window.show()
  window.focus()
}

function toggleWindow(window: BrowserWindow | null): void {
  if (!window) return
  if (window.isVisible()) window.hide()
  else showWindow(window)
}
