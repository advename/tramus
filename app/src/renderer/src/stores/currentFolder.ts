import { create } from 'zustand'

/**
 * The library folder currently open in this session (set by the Library screen once it loads a
 * folder successfully). Batch's "Choose" step reads this to list "videos of the current library
 * folder" without needing its own `?folder=` param — the design's Batch flow is always entered
 * from a Library folder (directly or via "Track" on a selection).
 */
interface CurrentFolderState {
  path: string | null
  name: string | null
  setFolder: (folder: { path: string; name: string } | null) => void
}

export const useCurrentFolderStore = create<CurrentFolderState>()((set) => ({
  path: null,
  name: null,
  setFolder: (folder) => set({ path: folder?.path ?? null, name: folder?.name ?? null })
}))
