import { contextBridge, ipcRenderer } from 'electron'

import {
  IpcChannel,
  type AppInfo,
  type EngineConnection,
  type SaveFileOptions,
  type TramusApi
} from '@shared/ipc'

const tramusApi: TramusApi = {
  dialog: {
    openFolder: () => ipcRenderer.invoke(IpcChannel.DialogOpenFolder) as Promise<string | null>,
    saveFile: (options: SaveFileOptions) =>
      ipcRenderer.invoke(IpcChannel.DialogSaveFile, options) as Promise<string | null>
  },
  shell: {
    showItemInFolder: (path: string) =>
      ipcRenderer.invoke(IpcChannel.ShellShowItemInFolder, path) as Promise<void>,
    openPrivacySettings: () =>
      ipcRenderer.invoke(IpcChannel.ShellOpenPrivacySettings) as Promise<void>
  },
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.AppGetInfo) as Promise<AppInfo>
  },
  engine: {
    getConnection: () =>
      ipcRenderer.invoke(IpcChannel.EngineGetConnection) as Promise<EngineConnection>
  }
}

// contextIsolation is always on (see src/main/index.ts webPreferences), so `window.tramus` must
// be bridged rather than assigned directly.
contextBridge.exposeInMainWorld('tramus', tramusApi)
