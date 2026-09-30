import { create } from 'zustand'

/**
 * Folders the engine has told us it can't read (HTTP 403 — an OS permission denial, typically
 * macOS's per-folder privacy protection after "Don't Allow"), keyed by folder path. Session-only
 * (not persisted): the engine is the source of truth for whether a folder is actually readable,
 * this just remembers the last answer so `StartScreen`'s recent-folder list and `AppShell`'s
 * Library nav shortcut don't send the user straight back into a folder that's known to fail.
 */
interface FolderAccessState {
  inaccessible: Record<string, string>
  markInaccessible: (path: string, detail: string) => void
  markAccessible: (path: string) => void
}

export const useFolderAccessStore = create<FolderAccessState>()((set) => ({
  inaccessible: {},
  markInaccessible: (path, detail) =>
    set((state) => ({ inaccessible: { ...state.inaccessible, [path]: detail } })),
  markAccessible: (path) =>
    set((state) => {
      if (!(path in state.inaccessible)) return state
      const { [path]: _removed, ...rest } = state.inaccessible
      return { inaccessible: rest }
    })
}))
