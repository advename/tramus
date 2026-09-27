import { useEffect } from 'react'

import { useFrameTimes } from '../../../api/queries'
import { useWorkspaceStore } from '../state/workspaceStore'

/**
 * The video's frame-times array, kept in sync with the store's `frameCount` (so `seek`/`stepFrames`
 * clamp correctly). Cheap to call from multiple components — `useFrameTimes` is a cached query and
 * `setFrameCount` is idempotent for an unchanged length.
 */
export function useVideoTiming(videoId: string): Float64Array | undefined {
  const { data: frameTimes } = useFrameTimes(videoId)
  const setFrameCount = useWorkspaceStore((s) => s.setFrameCount)

  useEffect(() => {
    if (frameTimes) setFrameCount(frameTimes.length)
  }, [frameTimes, setFrameCount])

  return frameTimes
}
