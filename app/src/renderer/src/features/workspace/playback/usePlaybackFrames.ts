import { useCallback, useEffect, useRef, useState } from 'react'

import { frameUrl } from '../../../api/urls'
import { LruMap } from './lruMap'
import {
  computeStride,
  lookaheadCount,
  nextGridFrame,
  pickDisplayFrame,
  predictFrames
} from './frameSchedule'

/** In-flight fetch workers. Each claims the next predicted, not-yet-cached frame in a loop. */
const MAX_INFLIGHT = 4
/** How far ahead of the clock to keep frames warm (in flight + cached). Must exceed the fetch +
 * decode latency, or frames arrive after the clock has passed them and are never shown. */
const LOOKAHEAD_S = 0.6
/** Bitmap cache size — comfortably more than `LOOKAHEAD` so recently-shown frames survive a
 * brief stall (or a pause/resume) without being evicted out from under the draw. */
const CACHE_CAPACITY = 24
/** The request-rate budget `computeStride` schedules against. Not the display fps target (that's
 * 24–30, see the playback brief) — this is the ceiling on distinct decodes/s the pipeline will
 * ask the engine for; higher than the display target so the stride doesn't thin frames out more
 * than necessary for a smooth screen. */
const TARGET_FETCH_FPS = 60
/** Reduced JPEG quality while playing — the point is to keep up with the clock, not to show every
 * pixel; the exact/full-quality frame is fetched once playback stops (see `VideoStage.tsx`). */
const PLAYING_QUALITY = 70

export interface PlaybackFrameParams {
  videoId: string
  /** Whether the pipeline should be actively requesting frames; false while paused/scrubbing. */
  playing: boolean
  currentFrame: number
  frameCount: number
  speed: number
  /** The video's own frame rate, for stride prediction (falls back to 25 if unknown). */
  sourceFpsHint: number
  maxSide: number
  brightness: number
  contrast: number
}

interface Display {
  frame: number
  bitmap: ImageBitmap
}

/**
 * Frame bitmaps for active playback: predicts which source frames the clock is about to need
 * (`frameSchedule.ts`'s stride, aligned to `currentFrame`), keeps up to `MAX_INFLIGHT` requests
 * in flight at once, and caches decoded bitmaps by frame index in a bounded LRU (`lruMap.ts`) —
 * instead of the old one-request-at-a-time pipeline, where each displayed frame paid a full
 * serial round trip (fetch → decode → bitmap → state → render → next fetch).
 *
 * The fetch workers run continuously from mount (cheap when idle — just a parked promise); they
 * only start actually requesting frames once `playing` is true and `frameSchedule.ts` has
 * something to predict. Pausing doesn't tear the cache down, so resuming shortly after can reuse
 * what's already decoded. The cache is only invalidated (and closed) when the video, size or
 * image adjustments change, since those change what a given frame index decodes to.
 *
 * The displayed bitmap is pushed into state only when the newest-at-or-before-the-clock cached
 * frame actually changes (`frameSchedule.ts#pickDisplayFrame`) — at the rate of displayed
 * frames, not network arrivals or clock ticks — and each push carries just an `ImageBitmap`
 * reference. Only meaningful while `playing`; pause/scrub uses the exact single-flight path in
 * `VideoStage.tsx` instead (`useImageBitmap` fetching `currentFrame` directly).
 */
export function usePlaybackFrames(params: PlaybackFrameParams): ImageBitmap | null {
  const {
    videoId,
    playing,
    currentFrame,
    frameCount,
    speed,
    sourceFpsHint,
    maxSide,
    brightness,
    contrast
  } = params

  const [display, setDisplay] = useState<Display | null>(null)
  const displayRef = useRef<Display | null>(null)
  const currentFrameRef = useRef(currentFrame)

  const cacheRef = useRef(new LruMap<number, ImageBitmap>(CACHE_CAPACITY))
  const inflightRef = useRef(new Set<number>())
  const wantedRef = useRef<number[]>([])
  /** Resolvers of idle workers; `wakeAll` releases every one of them (not just the last). */
  const wakersRef = useRef(new Set<() => void>())
  /** Bitmaps no longer in the cache but possibly still referenced by `display` — closed once
   * React has committed past any render that could still be drawing them. */
  const retiredRef = useRef<ImageBitmap[]>([])

  // Keep ref mirrors of render values for the fetch workers below, whose effect doesn't re-run
  // every tick (so a long-lived closure inside it must read the *live* values via refs instead
  // of the ones captured when the effect last ran).
  useEffect(() => {
    displayRef.current = display
  }, [display])
  useEffect(() => {
    currentFrameRef.current = currentFrame
  }, [currentFrame])

  const stride = computeStride(sourceFpsHint, speed, TARGET_FETCH_FPS)

  // Recomputes which cached frame should be showing, from the live cache + clock, and pushes it
  // into state only if it changed. Stable identity so effects that call it never need to restart.
  const refreshDisplay = useCallback((): void => {
    const cache = cacheRef.current
    const frame = pickDisplayFrame(
      cache.keys(),
      currentFrameRef.current,
      displayRef.current?.frame ?? null
    )
    if (frame === null || frame === displayRef.current?.frame) return
    const bitmap = cache.peek(frame)
    if (!bitmap) return
    setDisplay({ frame, bitmap })
  }, [])

  // Keep the wanted (predicted) frame set current, and re-derive the display pick, every time
  // the clock advances or playback (re)starts.
  useEffect(() => {
    const count = lookaheadCount(LOOKAHEAD_S, sourceFpsHint, speed, stride, MAX_INFLIGHT * 2)
    wantedRef.current = playing
      ? predictFrames(nextGridFrame(currentFrame, stride), stride, count, frameCount)
      : []
    wakeAll(wakersRef.current)
    refreshDisplay()
  }, [playing, currentFrame, stride, frameCount, sourceFpsHint, speed, refreshDisplay])

  // Fetch workers: up to MAX_INFLIGHT concurrent loops, each repeatedly claims the
  // highest-priority wanted frame that isn't cached or already being fetched, fetches it at
  // reduced quality, decodes it, and caches it. They run from mount and simply idle (parked in
  // `waitForWake`) whenever `wantedRef` is empty (i.e. not playing) — restarting only when the
  // video/size/adjustments change invalidates every cached bitmap.
  useEffect(() => {
    let stopped = false
    const controller = new AbortController()
    const cache = cacheRef.current
    const inflight = inflightRef.current
    const wakers = wakersRef.current

    const waitForWake = (): Promise<void> =>
      new Promise((resolve) => {
        wakers.add(resolve)
      })

    const claimNext = (): number | null => {
      for (const frame of wantedRef.current) {
        if (cache.has(frame) || inflight.has(frame)) continue
        return frame
      }
      return null
    }

    const worker = async (): Promise<void> => {
      while (!stopped) {
        const frame = claimNext()
        if (frame === null) {
          await waitForWake()
          continue
        }
        inflight.add(frame)
        try {
          const url = frameUrl(videoId, frame, {
            maxSide,
            brightness,
            contrast,
            quality: PLAYING_QUALITY
          })
          const response = await fetch(url, { signal: controller.signal })
          if (response.ok) {
            const blob = await response.blob()
            const bitmap = await createImageBitmap(blob)
            if (stopped) {
              bitmap.close()
              break
            }
            const evicted = cache.set(frame, bitmap)
            if (evicted) retiredRef.current.push(evicted[1])
            refreshDisplay()
          }
        } catch {
          if (stopped) break
        } finally {
          inflight.delete(frame)
        }
      }
    }

    const workers = Array.from({ length: MAX_INFLIGHT }, () => worker())
    void Promise.all(workers)

    return () => {
      stopped = true
      controller.abort()
      wakeAll(wakers)
      inflight.clear()
      // Retire rather than close outright — `display` may still reference one of these.
      retiredRef.current.push(...cache.values())
      cache.clear()
    }
  }, [videoId, maxSide, brightness, contrast, refreshDisplay])

  // Close bitmaps retired from the cache once React has committed past the render that could
  // still be drawing them as `display.bitmap`.
  useEffect(() => {
    const retired = retiredRef.current
    retiredRef.current = []
    for (const bitmap of retired) if (bitmap !== display?.bitmap) bitmap.close()
  }, [display])

  // Final safety net: close anything left open (e.g. still-retired bitmaps between renders) on
  // unmount, when nothing will observe `display` changing again.
  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      for (const bitmap of cache.values()) bitmap.close()
      for (const bitmap of retiredRef.current) bitmap.close()
      retiredRef.current = []
    }
  }, [])

  return playing ? (display?.bitmap ?? null) : null
}

function wakeAll(wakers: Set<() => void>): void {
  const pending = [...wakers]
  wakers.clear()
  for (const wake of pending) wake()
}
