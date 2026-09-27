import type { FlagFilter } from '../state/workspaceStore'
import type { FlagStatus, FlagView } from '../../../api/types'

/** Human-readable label for a flag's `reason` (`docs/architecture.md` §5.2). */
export function flagReasonLabel(reason: string): string {
  switch (reason) {
    case 'not_found':
      return 'Mouse not found'
    case 'sudden_jump':
      return 'Sudden jump'
    case 'unusual_size':
      return 'Unusual size'
    default:
      return reason
  }
}

export const FLAG_STATUS_LABEL: Record<FlagStatus, string> = {
  unresolved: 'Unresolved',
  fixed: 'Fixed',
  accepted: 'Accepted'
}

/** Above this many flags, the Review › Flags panel hints that detection settings may be off. */
export const MANY_FLAGS_THRESHOLD = 20

export function countByStatus(flags: readonly FlagView[]): Record<FlagFilter, number> {
  const counts: Record<FlagFilter, number> = { all: flags.length, unresolved: 0, fixed: 0, accepted: 0 }
  for (const flag of flags) counts[flag.status]++
  return counts
}

export function filterFlags(flags: readonly FlagView[], filter: FlagFilter): FlagView[] {
  if (filter === 'all') return [...flags]
  return flags.filter((flag) => flag.status === filter)
}

/** The flag (if any) whose frame range contains `frame` — for the on-stage flag banner. */
export function flagAtFrame(flags: readonly FlagView[], frame: number): FlagView | undefined {
  return flags.find((flag) => frame >= flag.frame_start && frame <= flag.frame_end)
}

/**
 * The next/previous flag relative to `frame`, wrapping around. Flags are assumed sorted by
 * `frame_start` ascending (the engine returns them in track order).
 */
export function nextFlag(
  flags: readonly FlagView[],
  frame: number,
  direction: 1 | -1
): FlagView | undefined {
  if (flags.length === 0) return undefined
  if (direction > 0) {
    return flags.find((flag) => flag.frame_start > frame) ?? flags[0]
  }
  const before = [...flags].reverse().find((flag) => flag.frame_start < frame)
  return before ?? flags[flags.length - 1]
}
