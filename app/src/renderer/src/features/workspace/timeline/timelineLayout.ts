/** Sizing for the resizable timeline panel — the drag divider lives in `WorkspacePage`. */

const STORAGE_KEY = 'tramus.workspace.timelineHeight'

export const MIN_TIMELINE_HEIGHT = 140
export const DEFAULT_TIMELINE_HEIGHT = 220
const MAX_TIMELINE_HEIGHT_RATIO = 0.6

/** Clamps a candidate timeline height to `[MIN_TIMELINE_HEIGHT, 60% of viewportHeight]`. */
export function clampTimelineHeight(height: number, viewportHeight: number): number {
  const max = Math.max(MIN_TIMELINE_HEIGHT, viewportHeight * MAX_TIMELINE_HEIGHT_RATIO)
  return Math.min(max, Math.max(MIN_TIMELINE_HEIGHT, height))
}

/** Reads the saved timeline height; falls back to the default on any storage error or bad value. */
export function loadTimelineHeight(): number {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? Number(stored) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMELINE_HEIGHT
  } catch {
    return DEFAULT_TIMELINE_HEIGHT
  }
}

export function saveTimelineHeight(height: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(height))
  } catch {
    // Storage unavailable (private mode, quota, …) — the choice just won't persist.
  }
}
