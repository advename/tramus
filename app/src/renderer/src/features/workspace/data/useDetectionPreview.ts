import { useEffect, useRef, useState } from 'react'

import { getApiClient, unwrap } from '../../../api/client'
import type { DetectionPreview, Setup } from '../../../api/types'

interface WantedPreview {
  frameIndex: number
  setup: Setup
}

/**
 * "What the tracker sees" for the current frame: at most one `/detection-preview` request in
 * flight, latest-wins — the same pattern as `playback/useImageBitmap.ts`. A TanStack Query keyed
 * by frame index doesn't work here: during playback the key changes every clock tick, so every
 * previous key's in-flight fetch gets abandoned the moment the query stops being observed, and no
 * request ever resolves — the last preview just freezes on screen. Instead, once the in-flight
 * request settles, the newest wanted `(frameIndex, setup)` is requested next (frame dropping), so
 * the preview follows playback the same way the video frame does. While paused/scrubbing, each
 * distinct frame or setup change is still requested and shown exactly once it resolves; the
 * previous result stays visible in the meantime (no flash back to nothing).
 */
export function useDetectionPreview(
  videoId: string,
  frameIndex: number,
  setup: Setup,
  enabled: boolean
): DetectionPreview | undefined {
  const [result, setResult] = useState<DetectionPreview | undefined>(undefined)
  const wantedRef = useRef<WantedPreview | null>(null)
  const wakeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    wantedRef.current = enabled ? { frameIndex, setup } : null
    wakeRef.current?.()
  }, [enabled, frameIndex, setup])

  useEffect(() => {
    let stopped = false
    const controller = new AbortController()

    const waitForWake = (): Promise<void> =>
      new Promise((resolve) => {
        wakeRef.current = resolve
      })

    void (async () => {
      while (!stopped) {
        const target = wantedRef.current
        if (!target) {
          await waitForWake()
          continue
        }
        try {
          const preview = unwrap(
            await getApiClient().POST('/api/videos/{video_id}/detection-preview', {
              params: { path: { video_id: videoId } },
              body: { frame_index: target.frameIndex, setup: target.setup },
              signal: controller.signal
            })
          )
          if (!stopped) setResult(preview)
        } catch {
          if (stopped) break
          // Request failed for another reason (e.g. an invalid frame mid-scrub) — drop it and
          // try whatever's wanted now.
        }
        // Nothing newer arrived while we were fetching `target` — wait for the next change.
        if (wantedRef.current === target) await waitForWake()
      }
    })()

    return () => {
      stopped = true
      controller.abort()
      wakeRef.current?.()
      wakeRef.current = null
    }
  }, [videoId])

  return result
}
