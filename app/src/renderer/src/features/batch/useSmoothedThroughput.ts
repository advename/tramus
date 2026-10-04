import { useState } from 'react'

import { smoothThroughput } from './lib'

/** Smooths the batch's combined fps over its updates. Holds the last estimate while no job
 * reports a rate (e.g. between one video ending and the next starting); `null` until the first
 * rate arrives. */
export function useSmoothedThroughput(fps: number): number | null {
  const [state, setState] = useState<{ fps: number; smoothed: number | null }>({
    fps: 0,
    smoothed: null
  })
  if (fps !== state.fps) {
    // Derived from the previous render's state, so adjust it during render rather than in an effect.
    setState({ fps, smoothed: fps > 0 ? smoothThroughput(state.smoothed, fps) : state.smoothed })
  }
  return state.smoothed
}
