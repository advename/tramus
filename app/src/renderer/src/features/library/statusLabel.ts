import type { VideoStatus } from '../../api/types'

/** Mirrors `StatusChip`'s internal label map (not exported there) — used by the status filter. */
export const STATUS_LABEL: Record<VideoStatus, string> = {
  new: 'New',
  set_up: 'Set up',
  tracked: 'Tracked',
  reviewed: 'Reviewed',
  exported: 'Exported'
}
