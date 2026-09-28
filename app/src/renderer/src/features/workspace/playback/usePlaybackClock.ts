import { useEffect, useRef } from 'react'

import { useWorkspaceStore } from '../state/workspaceStore'
import { initPlaybackClock, stepPlaybackClock, type PlaybackClockState } from './playbackStep'

/**
 * The playback clock: while `playing`, advances a continuous video-time clock by `dt × speed`
 * every animation frame (see `playbackStep.ts` for the pure stepping logic) and maps it to a
 * frame index. The clock is re-synced to `currentFrame`'s own time whenever something else moved
 * it (a seek/scrub/step) since the last tick, and re-initialised whenever playback (re)starts.
 * Reads/writes the store via `getState()`/`seek()` instead of a selector, so this hook itself
 * never re-renders on every tick — only the components that subscribe to `currentFrame` (the
 * canvas, the playhead, …) do. Mount once per open workspace (e.g. in `VideoStage`); mounting it
 * twice would just race two harmless identical loops, but there's no need to.
 */
export function usePlaybackClock(frameTimes: Float64Array | undefined): void {
  const lastTimestampRef = useRef<number | null>(null)
  const clockRef = useRef<PlaybackClockState>({ time: 0, frame: 0 })

  useEffect(() => {
    if (!frameTimes || frameTimes.length === 0) return undefined

    let raf = 0

    const tick = (timestamp: number): void => {
      const last = lastTimestampRef.current
      lastTimestampRef.current = timestamp
      const store = useWorkspaceStore.getState()
      if (!store.playing) {
        lastTimestampRef.current = null
        return
      }
      if (last !== null) {
        const dt = (timestamp - last) / 1000
        const result = stepPlaybackClock(
          clockRef.current,
          store.currentFrame,
          dt,
          store.speed,
          frameTimes
        )
        clockRef.current = result.state
        if (result.finished) store.pause()
        store.seek(result.frame)
      }
      raf = requestAnimationFrame(tick)
    }

    // Re-arm whenever `playing` flips true, and stop cleanly when it flips false.
    const unsubscribe = useWorkspaceStore.subscribe((state, previous) => {
      if (state.playing && !previous.playing) {
        lastTimestampRef.current = null
        clockRef.current = initPlaybackClock(frameTimes, state.currentFrame)
        raf = requestAnimationFrame(tick)
      } else if (!state.playing && previous.playing) {
        cancelAnimationFrame(raf)
        lastTimestampRef.current = null
      }
    })

    const initial = useWorkspaceStore.getState()
    if (initial.playing) {
      // Keep sub-frame progress if the clock is still on the frame it last set.
      if (clockRef.current.frame !== initial.currentFrame) {
        clockRef.current = initPlaybackClock(frameTimes, initial.currentFrame)
      }
      raf = requestAnimationFrame(tick)
    }

    return () => {
      unsubscribe()
      cancelAnimationFrame(raf)
    }
  }, [frameTimes])
}
