import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../../../api/client'
import { useJob } from '../../../api/queries'
import { queryKeys } from '../../../api/queryKeys'
import type { FlagView, HistoryEntry, Job, Results, SessionState } from '../../../api/types'
import { toTrackData } from './trackData'

const path = (videoId: string) => ({ params: { path: { video_id: videoId } } })

/**
 * The open session of a video. The first fetch opens it on the engine (loading the sidecar or
 * starting a new document); opening is idempotent, so refetches never discard unsaved edits.
 */
export function useSession(videoId: string) {
  return useQuery({
    queryKey: queryKeys.session.detail(videoId),
    queryFn: async (): Promise<SessionState> =>
      unwrap(await getApiClient().POST('/api/videos/{video_id}/session', path(videoId))),
    staleTime: Infinity
  })
}

/** Whether the session has a track yet (drives which queries below are enabled). */
export function useIsTracked(videoId: string): boolean {
  return Boolean(useSession(videoId).data?.document.track_summary)
}

/** The effective track (raw + corrections) as typed arrays; `undefined` until tracked. */
export function useTrackData(videoId: string) {
  const tracked = useIsTracked(videoId)
  return useQuery({
    queryKey: queryKeys.track.detail(videoId),
    queryFn: async () =>
      unwrap(await getApiClient().GET('/api/videos/{video_id}/session/track', path(videoId))),
    select: toTrackData, // a stable function reference, so the typed arrays are built once per fetch
    enabled: tracked,
    placeholderData: keepPreviousData,
    staleTime: Infinity
  })
}

/** Flags overlapping the trial window, each with its current status. */
export function useFlags(videoId: string) {
  const tracked = useIsTracked(videoId)
  return useQuery({
    queryKey: queryKeys.flags.list(videoId),
    queryFn: async (): Promise<FlagView[]> =>
      unwrap(await getApiClient().GET('/api/videos/{video_id}/session/flags', path(videoId))),
    enabled: tracked,
    placeholderData: keepPreviousData
  })
}

/** Time per zone and zone visits; `null` until tracked. */
export function useResults(videoId: string) {
  const tracked = useIsTracked(videoId)
  return useQuery({
    queryKey: queryKeys.results.detail(videoId),
    // The engine answers `null` (not an error) before the video is tracked.
    queryFn: async (): Promise<Results | null> =>
      unwrap(await getApiClient().GET('/api/videos/{video_id}/session/results', path(videoId))),
    enabled: tracked,
    placeholderData: keepPreviousData
  })
}

/** The edit history, newest first. */
export function useHistory(videoId: string) {
  return useQuery({
    queryKey: queryKeys.history.list(videoId),
    queryFn: async (): Promise<HistoryEntry[]> =>
      unwrap(await getApiClient().GET('/api/videos/{video_id}/session/history', path(videoId)))
  })
}

/** The session's running tracking job (live via engine events), if any. */
export function useActiveJob(videoId: string): Job | null {
  const activeJob = useSession(videoId).data?.active_job ?? null
  const live = useJob(activeJob?.id).data
  return live ?? activeJob
}
