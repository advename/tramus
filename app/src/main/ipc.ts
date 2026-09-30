import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'

import { IpcChannel, type AppInfo, type EngineConnection, type SaveFileOptions } from '@shared/ipc'

import type { EngineProcess } from './engine'

/**
 * macOS's Privacy & Security → Files and Folders pane. The only URL `shell:openPrivacySettings`
 * will ever open — hardcoded rather than accepting anything from the renderer, so a compromised
 * or buggy renderer can't turn this handler into a generic "open any external URL" primitive.
 */
const MACOS_PRIVACY_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'

/** Registers all `ipcMain.handle` handlers. Call once, after the main window is created. */
export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null,
  engine: EngineProcess
): void {
  ipcMain.handle(IpcChannel.DialogOpenFolder, async (): Promise<string | null> => {
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(
    IpcChannel.DialogSaveFile,
    async (_event, options: SaveFileOptions): Promise<string | null> => {
      const win = getWindow()
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return null
      return result.filePath
    }
  )

  ipcMain.handle(IpcChannel.ShellShowItemInFolder, (_event, path: string): void => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle(IpcChannel.ShellOpenPrivacySettings, async (): Promise<void> => {
    // The renderer hides the "Open Privacy Settings" button on non-macOS, but a defensive no-op
    // here means this can never do anything else even if that ever regresses.
    if (process.platform !== 'darwin') return
    await shell.openExternal(MACOS_PRIVACY_SETTINGS_URL)
  })

  ipcMain.handle(IpcChannel.AppGetInfo, (): AppInfo => {
    const platform = process.platform
    if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
      throw new Error(`Unsupported platform: ${platform}`)
    }
    return { version: app.getVersion(), platform, arch: process.arch }
  })

  ipcMain.handle(IpcChannel.EngineGetConnection, (): Promise<EngineConnection> => engine.start())
}
