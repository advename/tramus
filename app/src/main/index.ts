import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'

import icon from '../../build/icon.png?asset'
import macIcon from '../../build/icon-macos.png?asset'
import { formatFullVersion } from '@shared/buildInfo'

import { loadBuildInfo } from './buildInfo'
import { EngineProcess, EngineStartupError } from './engine'
import { registerIpcHandlers } from './ipc'

// theme/tokens.ts `dark.background.default` (oklch(0.165 0.005 70)) converted to sRGB hex.
// Keeping this a plain constant (rather than importing culori at main-process startup) keeps
// the window paintable before the renderer or any dependency-heavy code has loaded.
const DARK_BACKGROUND_HEX = '#100e0c'

const isMac = process.platform === 'darwin'
// electron-vite sets ELECTRON_RENDERER_URL in dev; this mirrors @electron-toolkit/utils' `is.dev`
// without adding the dependency.
const isDev = !app.isPackaged
// Automated UI tests set this to render without showing (and focusing) a window.
const keepWindowHidden = process.env['TRAMUS_HIDDEN_WINDOW'] === '1'

let mainWindow: BrowserWindow | null = null
const buildInfo = loadBuildInfo()
const engine = new EngineProcess(formatFullVersion(buildInfo))

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: DARK_BACKGROUND_HEX,
    autoHideMenuBar: true,
    // macOS takes the window icon from the app bundle (or the Dock icon set below in dev).
    ...(isMac ? {} : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Chromium's spellchecker downloads Hunspell dictionaries from Google on Windows/Linux
      // (macOS uses the OS's own, offline). Tramus's privacy stance is "no network access", so
      // this stays off everywhere rather than only where it would otherwise phone home.
      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!keepWindowHidden) mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Never open windows inside the app. Plain https links go to the user's browser; anything else
  // (file:, custom protocols, …) is dropped.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (new URL(details.url).protocol === 'https:') void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function startEngineOrQuit(): Promise<void> {
  try {
    await engine.start()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stderrTail = error instanceof EngineStartupError ? error.stderrTail : ''
    dialog.showErrorBox(
      'Tramus engine failed to start',
      stderrTail ? `${message}\n\n${stderrTail}` : message
    )
    app.quit()
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('org.tramus.app')
    // Packaged builds get the Dock icon from icon.icns; in dev, Electron's own icon would show.
    if (isDev && isMac) app.dock?.setIcon(macIcon)

    createWindow()
    registerIpcHandlers(() => mainWindow, engine, buildInfo)
    void startEngineOrQuit()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })

  app.on('will-quit', () => {
    engine.stop()
  })
}
