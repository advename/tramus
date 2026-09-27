import { useEffect, useRef } from 'react'

import { frameAtTime, timeOfFrame, videoDuration } from '../lib/frames'
import { useWorkspaceStore } from '../state/workspaceStore'

/**
 * The playback clock: while `playing`, advances video time by `dt × speed` every animation frame
 * and maps it to a frame index. Reads/writes the store via `getState()`/`seek()` instead of a
 * selector, so this hook itself never re-renders on every tick — only the components that
 * subscribe to `currentFrame` (the canvas, the playhead, …) do. Mount once per open workspace
 * (e.g. in `VideoStage`); mounting it twice would just race two harmless identical loops, but
 * there's no need to.
 */
export function usePlaybackClock(frameTimes: Float64Array | undefined): void {
  const lastTimestampRef = useRef<number | null>(null)

  useEffect(() => {
    if (!frameTimes || frameTimes.length === 0) return undefined

    let raf = 0
    const duration = videoDuration(frameTimes)

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
        const currentTime = timeOfFrame(frameTimes, store.currentFrame)
        const nextTime = currentTime + dt * store.speed
        if (nextTime >= duration) {
          store.pause()
          store.seek(frameTimes.length - 1)
        } else {
          store.seek(frameAtTime(frameTimes, nextTime))
        }
      }
      raf = requestAnimationFrame(tick)
    }

    // Re-arm whenever `playing` flips true, and stop cleanly when it flips false.
    const unsubscribe = useWorkspaceStore.subscribe((state, previous) => {
      if (state.playing && !previous.playing) {
        lastTimestampRef.current = null
        raf = requestAnimationFrame(tick)
      } else if (!state.playing && previous.playing) {
        cancelAnimationFrame(raf)
        lastTimestampRef.current = null
      }
    })

    if (useWorkspaceStore.getState().playing) {
      raf = requestAnimationFrame(tick)
    }

    return () => {
      unsubscribe()
      cancelAnimationFrame(raf)
    }
  }, [frameTimes])
}
