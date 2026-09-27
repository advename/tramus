import { useEffect } from 'react'

/**
 * Warms the browser's HTTP cache for `url` (fire-and-forget — no bitmap decode). Used to prefetch
 * the next frame while playing, so `useImageBitmap`'s fetch is a cache hit when playback reaches it.
 */
export function usePrefetchUrl(url: string | null): void {
  useEffect(() => {
    if (!url) return undefined
    const controller = new AbortController()
    fetch(url, { signal: controller.signal }).catch(() => {})
    return () => controller.abort()
  }, [url])
}
