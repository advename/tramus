/**
 * IPC contract shared by the main process, the preload script and the renderer.
 *
 * Keeping channel names and payload/result types in one place means a change here is felt by
 * every side at compile time instead of failing silently at runtime.
 */

/** Channel names used with `ipcMain.handle` / `ipcRenderer.invoke`. */
export const IpcChannel = {
  DialogOpenFolder: 'dialog:openFolder',
  DialogSaveFile: 'dialog:saveFile',
  ShellShowItemInFolder: 'shell:showItemInFolder',
  AppGetInfo: 'app:getInfo',
  EngineGetConnection: 'engine:getConnection'
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

/** A single entry of Electron's `Filters` type for save dialogs, without pulling in `electron`. */
export interface FileFilter {
  name: string
  extensions: string[]
}

export interface SaveFileOptions {
  defaultPath?: string
  filters?: FileFilter[]
}

export interface AppInfo {
  /** package.json version. */
  version: string
  platform: 'darwin' | 'win32' | 'linux'
  arch: string
}

/** Where the local engine is listening, and the token every request must carry. */
export interface EngineConnection {
  baseUrl: string
  token: string
}

/**
 * The renderer-facing API exposed on `window.tramus` by the preload script.
 * Mirrored (structurally) by `src/preload/index.ts` and declared for the renderer in
 * `src/preload/global.d.ts`.
 */
export interface TramusApi {
  dialog: {
    /** Opens a native "choose folder" dialog. Resolves to `null` if the user cancels. */
    openFolder: () => Promise<string | null>
    /** Opens a native save-file dialog. Resolves to `null` if the user cancels. */
    saveFile: (options: SaveFileOptions) => Promise<string | null>
  }
  shell: {
    /** Reveals a file or folder in the OS file manager. */
    showItemInFolder: (path: string) => Promise<void>
  }
  app: {
    getInfo: () => Promise<AppInfo>
  }
  engine: {
    /**
     * Resolves once the local engine process has printed its `{"event":"ready",...}` line.
     * Rejects if the engine fails to start within the startup timeout.
     */
    getConnection: () => Promise<EngineConnection>
  }
}
