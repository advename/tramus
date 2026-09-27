import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'

import { IpcChannel, type AppInfo, type EngineConnection, type SaveFileOptions } from '@shared/ipc'

import type { EngineProcess } from './engine'

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

  ipcMain.handle(IpcChannel.AppGetInfo, (): AppInfo => {
    const platform = process.platform
    if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
      throw new Error(`Unsupported platform: ${platform}`)
    }
    return { version: app.getVersion(), platform, arch: process.arch }
  })

  ipcMain.handle(IpcChannel.EngineGetConnection, (): Promise<EngineConnection> => engine.start())
}
