import { useEffect, useRef, useState } from 'react'

interface Wanted<T> {
  url: string
  tag: T
}

export interface ImageBitmapResult<T> {
  bitmap: ImageBitmap | null
  /** Whatever `tag` was passed alongside the `url` that produced `bitmap` (e.g. a frame index) —
   * lags the latest requested `tag` while a newer fetch is still in flight, exactly like `bitmap`
   * lags the latest requested `url`. `null` before anything has loaded. Lets a caller know which
   * request the currently-shown bitmap actually answers, instead of assuming it's the latest one
   * asked for (see `VideoStage.tsx`'s `shownFrame`). */
  tag: T | null
}

/**
 * Loads `url` as an `ImageBitmap`: at most one request in flight. While a request is pending,
 * further `url` changes just update what's "wanted" — nothing is aborted, so an in-flight
 * request is never thrown away just because a newer frame is wanted (that's what broke
 * playback: the URL changes every animation frame, so every request used to be cancelled
 * before it could complete). When the in-flight request settles, its bitmap is shown (even if
 * a newer URL has since been requested — an older frame during playback is fine), then the
 * newest wanted URL is fetched immediately if it still differs (frame dropping, latest-wins).
 * Bitmaps that stop being displayed are closed; the real network request is aborted only when
 * the component unmounts. Used for both video frames (`frameUrl`) and the tracker's
 * detection-preview mask.
 *
 * `tag` is an arbitrary caller value carried alongside `url` (e.g. the frame index the URL was
 * built from) and returned next to the bitmap it produced — see `ImageBitmapResult`.
 */
export function useImageBitmap<T = undefined>(url: string | null, tag?: T): ImageBitmapResult<T> {
  const [result, setResult] = useState<ImageBitmapResult<T>>({ bitmap: null, tag: null })
  const currentRef = useRef<ImageBitmap | null>(null)
  /** Superseded bitmaps, closed only after React has committed their replacement. */
  const retiredRef = useRef<ImageBitmap[]>([])
  const wantedRef = useRef<Wanted<T> | null>(url ? { url, tag: tag as T } : null)
  // Set while the fetch loop (below) is parked between requests; resolves it once a wanted URL
  // becomes available again. Null while a request is in flight (nothing to wake).
  const wakeRef = useRef<(() => void) | null>(null)

  // Every render keeps the "latest wanted" ref current; the fetch loop (mount-only effect below)
  // always reads from it, so this never needs to restart the loop itself.
  useEffect(() => {
    wantedRef.current = url ? { url, tag: tag as T } : null
    wakeRef.current?.()
  }, [url, tag])

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
          const response = await fetch(target.url, { signal: controller.signal })
          if (response.ok) {
            const blob = await response.blob()
            const nextBitmap = await createImageBitmap(blob)
            if (stopped) {
              nextBitmap.close()
              break
            }
            if (currentRef.current) retiredRef.current.push(currentRef.current)
            currentRef.current = nextBitmap
            setResult({ bitmap: nextBitmap, tag: target.tag })
          }
        } catch {
          if (stopped) break
          // Fetch or decode failed for another reason — drop it and try whatever's wanted now.
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
      currentRef.current?.close()
      currentRef.current = null
      for (const old of retiredRef.current) old.close()
      retiredRef.current = []
    }
  }, [])

  // Closing a bitmap immediately would race React: a render that still holds the previous
  // bitmap (e.g. the canvas redrawing on resize) would draw a closed ("detached") image and throw.
  useEffect(() => {
    const retired = retiredRef.current
    retiredRef.current = []
    for (const old of retired) if (old !== result.bitmap) old.close()
  }, [result.bitmap])

  return result
}
