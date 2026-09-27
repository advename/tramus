import { frameUrl, type FrameUrlOptions } from '../../../api/urls'
import { useImageBitmap } from './useImageBitmap'
import { usePrefetchUrl } from './usePrefetchUrl'

/**
 * The current video frame as an `ImageBitmap`, ready to `drawImage` onto the stage canvas.
 * `options` should include the setup's brightness/contrast so what's drawn matches what's tracked
 * (see `docs/architecture.md` §5.1). While playing, also prefetches `frame + 1` so the next
 * `useImageBitmap` fetch is a cache hit.
 */
export function useFrameBitmap(
  videoId: string,
  frame: number,
  options: FrameUrlOptions,
  prefetchNext: { enabled: boolean; frameCount: number }
): ImageBitmap | null {
  const url = frameUrl(videoId, frame, options)
  const bitmap = useImageBitmap(url)

  const hasNext = prefetchNext.enabled && frame + 1 < prefetchNext.frameCount
  usePrefetchUrl(hasNext ? frameUrl(videoId, frame + 1, options) : null)

  return bitmap
}
