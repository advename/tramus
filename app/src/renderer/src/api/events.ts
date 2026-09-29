import { useEffect, useRef } from 'react'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'

import { getEngineConnection } from './connection'
import { TERMINAL_JOB_STATES } from './queries/jobs'
import { queryKeys } from './queryKeys'
import type { Job, SessionState } from './types'

type EngineEvent =
  { type: 'job'; job: Job } | { type: 'session'; video_id: string; state: SessionState }

function isEngineEvent(value: unknown): value is EngineEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  return value.type === 'job' || value.type === 'session'
}

function handleJobEvent(queryClient: QueryClient, job: Job): void {
  // Progress arrives many times per second: write it into the cache, never refetch for it.
  queryClient.setQueryData(queryKeys.jobs.detail(job.id), job)
  queryClient.setQueryData<Job[]>(queryKeys.jobs.all(), (jobs) => {
    if (!jobs) return jobs
    const index = jobs.findIndex((existing) => existing.id === job.id)
    return index === -1 ? [...jobs, job] : jobs.map((existing, i) => (i === index ? job : existing))
  })
  if (!TERMINAL_JOB_STATES.has(job.state)) return

  // A finished job changes the video's status and, for a session job, its document and track.
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.video.detail(job.video_id) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.session.detail(job.video_id) })
  if (job.batch_id) {
    // The batch's per-item status (`GET /batches/{id}`) is derived from the video's sidecar, so
    // it needs a refetch too — it doesn't come from the job event itself.
    void queryClient.invalidateQueries({ queryKey: queryKeys.batches.all() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.batches.detail(job.batch_id) })
  }
}

function handleSessionEvent(queryClient: QueryClient, videoId: string, state: SessionState): void {
  const previous = queryClient.getQueryData<SessionState>(queryKeys.session.detail(videoId))
  queryClient.setQueryData(queryKeys.session.detail(videoId), state)

  // Results, flags and history are small and depend on almost every edit.
  void queryClient.invalidateQueries({ queryKey: queryKeys.results.detail(videoId) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.flags.list(videoId) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.history.list(videoId) })

  // The effective track is large; it only changes with a new tracking run or new corrections.
  const trackChanged =
    previous?.document.track_summary?.tracked_at !== state.document.track_summary?.tracked_at ||
    previous?.document.corrections.length !== state.document.corrections.length
  if (trackChanged) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.track.detail(videoId) })
  }
}

function handleEvent(queryClient: QueryClient, event: EngineEvent): void {
  if (event.type === 'job') handleJobEvent(queryClient, event.job)
  else handleSessionEvent(queryClient, event.video_id, event.state)
}

const INITIAL_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 15_000

/**
 * Subscribes to the engine's `WS /api/events` for the lifetime of the calling component and
 * keeps the TanStack Query cache in sync — see `handleEvent` above. Reconnects with capped
 * exponential backoff if the socket drops (the engine restarting, the machine sleeping, …).
 *
 * Mount this once, near the root (e.g. in `AppShell`), not per-screen.
 */
export function useEngineEvents(): void {
  const queryClient = useQueryClient()
  const queryClientRef = useRef(queryClient)
  useEffect(() => {
    queryClientRef.current = queryClient
  }, [queryClient])

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let backoff = INITIAL_BACKOFF_MS
    let stopped = false

    const connect = (): void => {
      if (stopped) return
      const { baseUrl, token } = getEngineConnection()
      const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/api/events?token=${encodeURIComponent(token)}`
      const nextSocket = new WebSocket(wsUrl)
      socket = nextSocket

      nextSocket.addEventListener('open', () => {
        backoff = INITIAL_BACKOFF_MS
      })

      nextSocket.addEventListener('message', (event: MessageEvent<string>) => {
        let payload: unknown
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }
        if (isEngineEvent(payload)) handleEvent(queryClientRef.current, payload)
      })

      nextSocket.addEventListener('close', () => {
        if (stopped) return
        reconnectTimer = setTimeout(connect, backoff)
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
      })

      nextSocket.addEventListener('error', () => {
        nextSocket.close()
      })
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [])
}
