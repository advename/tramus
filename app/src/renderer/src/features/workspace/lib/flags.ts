import { useCallback, useState } from 'react'
import { alpha, type Theme } from '@mui/material/styles'

import type { CorrectionsEditor } from '../data/editors'
import type { FlagFilter } from '../state/workspaceStore'
import type { Correction, FlagStatus, FlagView } from '../../../api/types'

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
  const counts: Record<FlagFilter, number> = {
    all: flags.length,
    unresolved: 0,
    fixed: 0,
    accepted: 0
  }
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
 * The next/previous flag relative to `frame`, wrapping around, regardless of status — a fixed or
 * accepted flag is still revisitable. Flags are assumed sorted by `frame_start` ascending (the
 * engine returns them in track order).
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

/**
 * The next unresolved flag after `frame`, wrapping to the first unresolved flag — `excludeId`
 * drops the flag just accepted (its status hasn't necessarily updated in `flags` yet) so accepting
 * the only remaining unresolved flag correctly reports none left, rather than wrapping to itself.
 * Powers the Accept hotkey's "jump to the next thing to review" behaviour (`VideoStage`'s `A`).
 */
export function nextUnresolvedFlag(
  flags: readonly FlagView[],
  frame: number,
  excludeId?: string
): FlagView | undefined {
  const unresolved = flags.filter((flag) => flag.status === 'unresolved' && flag.id !== excludeId)
  return nextFlag(unresolved, frame, 1)
}

/** Background/text colour for a flag's status chip (Flags panel rows and the stage banner). */
export function statusChipSx(status: FlagStatus): {
  bgcolor: string | ((t: Theme) => string)
  color: string
} {
  switch (status) {
    case 'unresolved':
      return { bgcolor: (t: Theme) => alpha(t.palette.warning.main, 0.15), color: 'warning.main' }
    case 'fixed':
      return { bgcolor: (t: Theme) => alpha(t.palette.success.main, 0.16), color: 'success.main' }
    case 'accepted':
      return { bgcolor: 'surface.raised', color: 'text.secondary' }
  }
}

export interface FlagReopenPlan {
  /** Ids of the corrections `CorrectionsEditor.remove` should drop to reopen the flag. */
  correctionIds: string[]
  /** True when a removed correction's frame range extends beyond the flag's own range. */
  extendsBeyondFlag: boolean
}

/**
 * Corrections to remove to reopen `flag`: its `accept_flag`, plus any other correction whose
 * frame (`set_position`) or frame range (`mark_hidden`/`interpolate`) overlaps the flag's range
 * (`docs/architecture.md` §5.3 — status is `fixed` when such a correction overlaps).
 *
 * A correction that only partly overlaps (e.g. a long interpolate spanning several flags) is
 * removed *entirely*, not trimmed to the non-overlapping part: trimming would still leave it
 * overlapping the flag, so the flag would keep re-deriving as `fixed` and Reopen would silently
 * do nothing. `extendsBeyondFlag` tells the caller this happened, so it can say so before removing
 * (the frames outside the flag revert to the raw track too).
 */
export function correctionsToReopen(
  flag: FlagView,
  corrections: readonly Correction[]
): FlagReopenPlan {
  const correctionIds: string[] = []
  let extendsBeyondFlag = false
  for (const correction of corrections) {
    if (correction.kind === 'accept_flag') {
      if (correction.flag_id === flag.id) correctionIds.push(correction.id)
      continue
    }
    const start = correction.kind === 'set_position' ? correction.frame : correction.frame_start
    const end = correction.kind === 'set_position' ? correction.frame : correction.frame_end
    if (start > flag.frame_end || end < flag.frame_start) continue
    correctionIds.push(correction.id)
    if (start < flag.frame_start || end > flag.frame_end) extendsBeyondFlag = true
  }
  return { correctionIds, extendsBeyondFlag }
}

export interface ReopenFlagState {
  /** The flag pending confirmation, or null when the confirmation dialog is closed. */
  pending: FlagView | null
  /** Opens the confirmation dialog for `flag`. */
  request: (flag: FlagView) => void
  /** Confirms: removes the flag's corrections as one undoable step ('Reopen flag'). */
  confirm: () => void
  cancel: () => void
  /** Confirmation copy for `pending`, or null when nothing is pending. */
  description: string | null
}

/**
 * Drives the "Reopen flag" confirmation shared by the stage banner and the Flags panel row
 * action. See `correctionsToReopen` for what gets removed and why.
 */
export function useReopenFlag(correctionsEditor: CorrectionsEditor): ReopenFlagState {
  const [pending, setPending] = useState<FlagView | null>(null)
  const plan = pending ? correctionsToReopen(pending, correctionsEditor.corrections) : null

  const request = useCallback((flag: FlagView) => setPending(flag), [])
  const cancel = useCallback(() => setPending(null), [])
  const confirm = useCallback(() => {
    if (plan && plan.correctionIds.length > 0) {
      void correctionsEditor.remove(plan.correctionIds, 'Reopen flag')
    }
    setPending(null)
  }, [plan, correctionsEditor])

  const description = plan
    ? plan.extendsBeyondFlag
      ? 'This removes the corrections applied to this flag, including one that also covers frames outside it — that footage reverts to the raw track too.'
      : 'This removes the corrections applied to this flag so you can review and fix it again.'
    : null

  return { pending, request, cancel, confirm, description }
}
