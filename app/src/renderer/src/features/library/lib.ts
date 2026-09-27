import type { VideoStatus } from '../../api/types'

export type LibraryViewMode = 'table' | 'grid'

const VIEW_MODE_KEY = 'tramus.library.viewMode'

/** Reads the saved table/grid choice; falls back to `"table"` on any storage error. */
export function loadViewMode(): LibraryViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY)
    return stored === 'grid' ? 'grid' : 'table'
  } catch {
    return 'table'
  }
}

export function saveViewMode(mode: LibraryViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // Storage unavailable (private mode, quota, …) — the choice just won't persist.
  }
}

/** Which workspace step a video's row/card opens at, per its status. */
export function stepForStatus(status: VideoStatus): 'setup' | 'review' | 'results' {
  if (status === 'new' || status === 'set_up') return 'setup'
  if (status === 'tracked') return 'review'
  return 'results'
}

/** Whether a video has been tracked at least once, i.e. has results worth exporting. */
export function hasResults(status: VideoStatus): boolean {
  return status === 'tracked' || status === 'reviewed' || status === 'exported'
}
