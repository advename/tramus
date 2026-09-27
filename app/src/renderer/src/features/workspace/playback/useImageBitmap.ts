import { useEffect, useRef, useState } from 'react'

/**
 * Loads `url` as an `ImageBitmap`: one request in flight, latest wins (an in-flight request that
 * finishes after a newer one started is discarded), keeps showing the previous bitmap until the
 * next one decodes, and closes bitmaps once they're no longer displayed. Used for both video
 * frames (`frameUrl`) and the tracker's detection-preview mask.
 */
export function useImageBitmap(url: string | null): ImageBitmap | null {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const requestIdRef = useRef(0)
  const currentRef = useRef<ImageBitmap | null>(null)

  useEffect(() => {
    if (!url) return undefined
    const requestId = ++requestIdRef.current
    const controller = new AbortController()

    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) return
        const blob = await response.blob()
        const nextBitmap = await createImageBitmap(blob)
        if (requestIdRef.current !== requestId) {
          // A newer request started while this one was decoding — drop it.
          nextBitmap.close()
          return
        }
        const previous = currentRef.current
        currentRef.current = nextBitmap
        setBitmap(nextBitmap)
        previous?.close()
      } catch {
        // Aborted, or the frame failed to decode — keep showing the previous bitmap.
      }
    })()

    return () => controller.abort()
  }, [url])

  // Close the last bitmap when the component unmounts.
  useEffect(() => () => currentRef.current?.close(), [])

  return bitmap
}
