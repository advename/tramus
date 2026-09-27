import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../../../api/client'
import { useJob } from '../../../api/queries'
import { queryKeys } from '../../../api/queryKeys'
import type {
  DetectionPreview,
  FlagView,
  HistoryEntry,
  Job,
  Results,
  SessionState,
  Setup
} from '../../../api/types'
import { type TrackData, toTrackData } from './trackData'

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
    select: (track): TrackData => toTrackData(track),
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

/**
 * "What the tracker sees" for one frame with the given (possibly unsaved) setup. Keyed by the
 * settings that affect detection, so slider changes refetch while the previous image stays up.
 */
export function useDetectionPreview(
  videoId: string,
  frameIndex: number,
  setup: Setup,
  enabled: boolean
) {
  const { arena, image, detection } = setup
  return useQuery({
    queryKey: [
      ...queryKeys.video.detail(videoId),
      'preview',
      frameIndex,
      { arena, image, detection }
    ],
    queryFn: async (): Promise<DetectionPreview> =>
      unwrap(
        await getApiClient().POST('/api/videos/{video_id}/detection-preview', {
          ...path(videoId),
          body: { frame_index: frameIndex, setup }
        })
      ),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })
}
