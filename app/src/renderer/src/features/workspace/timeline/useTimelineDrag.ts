import type { RefObject } from 'react'

import type { Setup, TrialWindow } from '../../../api/types'
import type { SetupEditor } from '../data'
import { mergeExclusionEdge, moveExclusionEdge } from '../lib/exclusions'
import { nearestFrame, timeOfFrame, videoDuration } from '../lib/frames'
import { timeAtClientX } from '../lib/timelineScale'
import type { FrameRange } from '../state/workspaceStore'

type DragKind = 'playhead' | 'start' | 'end' | 'range' | 'exclusion-start' | 'exclusion-end'

function moveTrialStart(trial: TrialWindow, t: number, duration: number): TrialWindow {
  if (trial.locked_duration) {
    const length = trial.end_s - trial.start_s
    const start = Math.max(0, Math.min(t, duration - length))
    return { ...trial, start_s: start, end_s: start + length }
  }
  const start = Math.max(0, Math.min(t, trial.end_s - 0.01))
  return { ...trial, start_s: start }
}

function moveTrialEnd(trial: TrialWindow, t: number, duration: number): TrialWindow {
  if (trial.locked_duration) {
    const length = trial.end_s - trial.start_s
    const end = Math.min(duration, Math.max(t, length))
    return { ...trial, start_s: end - length, end_s: end }
  }
  const end = Math.min(duration, Math.max(t, trial.start_s + 0.01))
  return { ...trial, end_s: end }
}

export interface UseTimelineDragArgs {
  trackRef: RefObject<HTMLDivElement | null>
  durationS: number
  frameTimes: Float64Array | undefined
  trial: TrialWindow
  rangeEditable: boolean
  setupEditor: SetupEditor
  onSeek: (frame: number) => void
  onPauseForScrub: () => void
  onSetRange: (range: FrameRange | null) => void
  /** Called once, when an exclusion edge drag ends, with the (possibly merged) id to reselect —
   * see `mergeExclusionEdge`. */
  onSelectExclusion: (exclusionId: string) => void
}

export interface TimelineDragApi {
  onTrackPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
}

/**
 * The timeline's single pointer-drag state machine: scrubbing the playhead, dragging a trial
 * start/end handle (`data-drag="start"|"end"`), dragging an exclusion's start/end handle
 * (`data-drag="exclusion-start"|"exclusion-end"`, `data-exclusion-id` on the same element — see
 * `ExclusionBands`), or Shift-dragging a frame range (Review's Fill/Hide, or any step's Exclude —
 * see `Timeline`/`RangePopover`). Trial and exclusion edits preview continuously and commit once
 * on release (`useSetupEditor`), so a drag is one request and one undo step.
 */
export function useTimelineDrag(args: UseTimelineDragArgs): TimelineDragApi {
  const {
    trackRef,
    durationS,
    frameTimes,
    trial,
    rangeEditable,
    setupEditor,
    onSeek,
    onPauseForScrub,
    onSetRange,
    onSelectExclusion
  } = args

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement
    if (target.closest('[data-no-drag]')) return
    const handle = target.closest<HTMLElement>('[data-drag]')
    let kind: DragKind = handle ? (handle.dataset.drag as DragKind) : 'playhead'
    const exclusionId = handle?.dataset.exclusionId
    if (e.shiftKey && rangeEditable) kind = 'range'

    const track = trackRef.current
    if (!track) return
    onPauseForScrub()
    const rect = track.getBoundingClientRect()
    const setupAtStart = setupEditor.setup
    const t0 = timeAtClientX(e.clientX, rect, durationS)

    const exclusionSide = (k: DragKind): 'start' | 'end' | null =>
      k === 'exclusion-start' ? 'start' : k === 'exclusion-end' ? 'end' : null

    const apply = (t: number): void => {
      if (kind === 'playhead') {
        if (frameTimes) onSeek(nearestFrame(frameTimes, t))
        return
      }
      if (kind === 'range') {
        if (!frameTimes) return
        onSetRange({
          start: nearestFrame(frameTimes, Math.min(t0, t)),
          end: nearestFrame(frameTimes, Math.max(t0, t))
        })
        return
      }
      const side = exclusionSide(kind)
      if (side) {
        if (!setupAtStart || !frameTimes || !exclusionId) return
        const snapped = timeOfFrame(frameTimes, nearestFrame(frameTimes, t))
        // No merging while previewing (see `moveExclusionEdge`) — only on release, so the id being
        // dragged stays stable for the length of the gesture.
        const nextExclusions = moveExclusionEdge(
          setupAtStart.exclusions ?? [],
          exclusionId,
          side,
          snapped
        )
        setupEditor.preview({ ...setupAtStart, exclusions: nextExclusions } satisfies Setup)
        return
      }
      if (!setupAtStart || !frameTimes) return
      const snapped = timeOfFrame(frameTimes, nearestFrame(frameTimes, t))
      const duration = videoDuration(frameTimes)
      const nextTrial =
        kind === 'start'
          ? moveTrialStart(trial, snapped, duration)
          : moveTrialEnd(trial, snapped, duration)
      setupEditor.preview({ ...setupAtStart, trial: nextTrial } satisfies Setup)
    }

    apply(t0)

    const onMove = (ev: PointerEvent): void => apply(timeAtClientX(ev.clientX, rect, durationS))
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const side = exclusionSide(kind)
      if (side) {
        if (!setupAtStart || !frameTimes || !exclusionId) return
        const finalT = timeAtClientX(ev.clientX, rect, durationS)
        const snapped = timeOfFrame(frameTimes, nearestFrame(frameTimes, finalT))
        const { exclusions: nextExclusions, id } = mergeExclusionEdge(
          setupAtStart.exclusions ?? [],
          exclusionId,
          side,
          snapped
        )
        void setupEditor.commit(
          { ...setupAtStart, exclusions: nextExclusions },
          'Edit exclusion',
          setupAtStart
        )
        onSelectExclusion(id)
        return
      }
      if (kind !== 'start' && kind !== 'end') return
      if (!setupAtStart || !frameTimes) return
      const finalT = timeAtClientX(ev.clientX, rect, durationS)
      const snapped = timeOfFrame(frameTimes, nearestFrame(frameTimes, finalT))
      const duration = videoDuration(frameTimes)
      const nextTrial =
        kind === 'start'
          ? moveTrialStart(trial, snapped, duration)
          : moveTrialEnd(trial, snapped, duration)
      const label = trial.locked_duration
        ? 'Move trial'
        : kind === 'start'
          ? 'Set trial start'
          : 'Set trial end'
      void setupEditor.commit({ ...setupAtStart, trial: nextTrial }, label, setupAtStart)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return { onTrackPointerDown }
}

export { moveTrialEnd, moveTrialStart }
