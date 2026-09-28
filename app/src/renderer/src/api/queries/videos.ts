import { useQuery } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import { queryKeys } from '../queryKeys'
import type { VideoSummary } from '../types'

export function useVideo(videoId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.video.detail(videoId ?? ''),
    queryFn: async (): Promise<VideoSummary> =>
      unwrap(
        await getApiClient().GET('/api/videos/{video_id}', {
          params: { path: { video_id: videoId! } }
        })
      ),
    enabled: Boolean(videoId)
  })
}

// Module-level so TanStack Query memoises the result: an inline `select` would build a new
// array on every render, and consumers keyed on it (the playback clock) would keep restarting.
const toFrameTimes = (response: { t: number[] }): Float64Array => Float64Array.from(response.t)

/**
 * Presentation time (seconds since the first frame) of every frame, as a typed array. This is
 * the only correct way to map between frame index and time — recordings are variable frame rate.
 */
export function useFrameTimes(videoId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.video.frameTimes(videoId ?? ''),
    queryFn: async () =>
      unwrap(
        await getApiClient().GET('/api/videos/{video_id}/frame-times', {
          params: { path: { video_id: videoId! } }
        })
      ),
    select: toFrameTimes,
    enabled: Boolean(videoId),
    staleTime: Infinity
  })
}
