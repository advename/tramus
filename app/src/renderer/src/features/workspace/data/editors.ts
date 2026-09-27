import { useCallback, useEffect, useMemo, useRef } from 'react'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../../../api/client'
import { useCancelJob } from '../../../api/queries'
import { queryKeys } from '../../../api/queryKeys'
import type { Correction, Job, SessionState, Setup } from '../../../api/types'
import { notifyError } from '../../../stores/notifications'
import { type EditRecord, useWorkspaceStore } from '../state/workspaceStore'
import { useSession } from './queries'

/*
 * Editing the session document.
 *
 * Every edit is applied optimistically to the cached SessionState, sent to the engine in order
 * (one request at a time per video, so responses can't overtake each other), and recorded as one
 * undoable step. Continuous gestures (dragging a zone, moving a slider) call `preview()` while
 * the gesture runs and `commit()` once at the end, so a drag is one request and one undo step.
 */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
/** A correction as created by the UI; `id` and `created_at` are filled in by `add()`. */
export type NewCorrection = DistributiveOmit<Correction, 'id' | 'created_at'>

const requestQueues = new Map<string, Promise<unknown>>()
const latestRequest = new Map<string, number>()

/** Runs `task` after every earlier task for the same video has settled. */
function enqueue<T>(videoId: string, task: () => Promise<T>): Promise<T> {
  const previous = requestQueues.get(videoId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(task)
  requestQueues.set(videoId, next)
  return next
}

function newId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function patchDocument(
  queryClient: QueryClient,
  videoId: string,
  patch: Partial<SessionState['document']>
): void {
  queryClient.setQueryData<SessionState>(queryKeys.session.detail(videoId), (state) =>
    state ? { ...state, dirty: true, document: { ...state.document, ...patch } } : state
  )
}

function invalidateDerived(queryClient: QueryClient, videoId: string, trackToo: boolean): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.results.detail(videoId) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.flags.list(videoId) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.history.list(videoId) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.video.detail(videoId) })
  if (trackToo) void queryClient.invalidateQueries({ queryKey: queryKeys.track.detail(videoId) })
}

/**
 * Sends a document value to the engine in order and writes the response into the cache — but
 * only if no newer edit was queued meanwhile (that edit's optimistic value must stay visible).
 */
function persist(
  queryClient: QueryClient,
  videoId: string,
  kind: EditRecord['kind'],
  value: Setup | Correction[]
): Promise<void> {
  const ticket = (latestRequest.get(videoId) ?? 0) + 1
  latestRequest.set(videoId, ticket)
  return enqueue(videoId, async () => {
    const params = { params: { path: { video_id: videoId } } }
    const state =
      kind === 'setup'
        ? unwrap(
            await getApiClient().PUT('/api/videos/{video_id}/session/setup', {
              ...params,
              body: value as Setup
            })
          )
        : unwrap(
            await getApiClient().PUT('/api/videos/{video_id}/session/corrections', {
              ...params,
              body: value as Correction[]
            })
          )
    if (latestRequest.get(videoId) === ticket) {
      queryClient.setQueryData(queryKeys.session.detail(videoId), state)
    }
    invalidateDerived(queryClient, videoId, kind === 'corrections')
  })
}

function applyEditValue(
  queryClient: QueryClient,
  videoId: string,
  edit: EditRecord,
  which: 'before' | 'after'
) {
  const value = edit[which]
  if (edit.kind === 'setup') patchDocument(queryClient, videoId, { setup: value as Setup })
  else patchDocument(queryClient, videoId, { corrections: value as Correction[] })
  return persist(queryClient, videoId, edit.kind, value)
}

export interface SetupEditor {
  /** The current (possibly optimistic) setup; undefined while the session loads. */
  setup: Setup | undefined
  /** Shows `next` immediately without saving (e.g. on every pointer move of a drag). */
  preview: (next: Setup) => void
  /**
   * Saves `next` as one undoable step labelled `label` (e.g. 'Move zone “Center”').
   * `before` is the setup when the gesture started; defaults to the setup before this call.
   */
  commit: (next: Setup, label: string, before?: Setup) => Promise<void>
  /** For sliders: preview now, commit after 300 ms without further changes (one undo step). */
  commitDebounced: (next: Setup, label: string) => void
}

export function useSetupEditor(videoId: string): SetupEditor {
  const queryClient = useQueryClient()
  const pushEdit = useWorkspaceStore((s) => s.pushEdit)
  const setup = useSession(videoId).data?.document.setup
  const debounce = useRef<{ timer: ReturnType<typeof setTimeout>; before: Setup } | null>(null)

  const currentSetup = useCallback(
    () => queryClient.getQueryData<SessionState>(queryKeys.session.detail(videoId))?.document.setup,
    [queryClient, videoId]
  )

  const preview = useCallback(
    (next: Setup) => patchDocument(queryClient, videoId, { setup: next }),
    [queryClient, videoId]
  )

  const commit = useCallback(
    async (next: Setup, label: string, before?: Setup) => {
      const base = before ?? currentSetup()
      if (!base || sameValue(base, next)) {
        if (base) preview(base)
        return
      }
      preview(next)
      pushEdit({ kind: 'setup', label, before: base, after: next })
      try {
        await persist(queryClient, videoId, 'setup', next)
      } catch (error) {
        preview(base)
        notifyError('Couldn’t save the setup change', error)
      }
    },
    [currentSetup, preview, pushEdit, queryClient, videoId]
  )

  const commitDebounced = useCallback(
    (next: Setup, label: string) => {
      const pending = debounce.current
      const before = pending?.before ?? currentSetup()
      if (pending) clearTimeout(pending.timer)
      if (!before) return
      preview(next)
      debounce.current = {
        before,
        timer: setTimeout(() => {
          debounce.current = null
          void commit(next, label, before)
        }, 300)
      }
    },
    [commit, currentSetup, preview]
  )

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current.timer)
    },
    []
  )

  return useMemo(
    () => ({ setup, preview, commit, commitDebounced }),
    [setup, preview, commit, commitDebounced]
  )
}

export interface CorrectionsEditor {
  corrections: Correction[]
  /** Appends a correction as one undoable step. */
  add: (correction: NewCorrection, label: string) => Promise<void>
}

export function useCorrectionsEditor(videoId: string): CorrectionsEditor {
  const queryClient = useQueryClient()
  const pushEdit = useWorkspaceStore((s) => s.pushEdit)
  const corrections = useSession(videoId).data?.document.corrections
  const stable = useMemo(() => corrections ?? [], [corrections])

  const add = useCallback(
    async (correction: NewCorrection, label: string) => {
      const before =
        queryClient.getQueryData<SessionState>(queryKeys.session.detail(videoId))?.document
          .corrections ?? []
      const created: Correction = {
        ...correction,
        id: newId(),
        created_at: new Date().toISOString()
      }
      const after = [...before, created]
      patchDocument(queryClient, videoId, { corrections: after })
      pushEdit({ kind: 'corrections', label, before, after })
      try {
        await persist(queryClient, videoId, 'corrections', after)
      } catch (error) {
        patchDocument(queryClient, videoId, { corrections: before })
        notifyError('Couldn’t save the correction', error)
      }
    },
    [pushEdit, queryClient, videoId]
  )

  return useMemo(() => ({ corrections: stable, add }), [stable, add])
}

export interface UndoRedo {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Label of the step `undo()` would revert, for tooltips ("Undo Move zone “Center”"). */
  undoLabel: string | undefined
  redoLabel: string | undefined
}

export function useUndoRedo(videoId: string): UndoRedo {
  const queryClient = useQueryClient()
  const undoStack = useWorkspaceStore((s) => s.undoStack)
  const redoStack = useWorkspaceStore((s) => s.redoStack)
  const takeUndo = useWorkspaceStore((s) => s.takeUndo)
  const takeRedo = useWorkspaceStore((s) => s.takeRedo)

  const run = useCallback(
    (edit: EditRecord | undefined, which: 'before' | 'after') => {
      if (!edit) return
      applyEditValue(queryClient, videoId, edit, which).catch((error: unknown) =>
        notifyError(which === 'before' ? 'Couldn’t undo' : 'Couldn’t redo', error)
      )
    },
    [queryClient, videoId]
  )

  return {
    undo: () => run(takeUndo(), 'before'),
    redo: () => run(takeRedo(), 'after'),
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.at(-1)?.label,
    redoLabel: redoStack.at(-1)?.label
  }
}

export interface SessionActions {
  save: () => Promise<void>
  discard: () => Promise<void>
  /** Starts tracking with the session's current setup. */
  startTracking: () => Promise<Job | undefined>
  cancelTracking: (jobId: string) => Promise<void>
  /** Replaces the setup with a template's (one undoable step). */
  applyTemplate: (templateId: string) => Promise<void>
}

export function useSessionActions(videoId: string): SessionActions {
  const queryClient = useQueryClient()
  const pushEdit = useWorkspaceStore((s) => s.pushEdit)
  const cancelJob = useCancelJob()
  const key = queryKeys.session.detail(videoId)
  const params = { params: { path: { video_id: videoId } } }

  const replaceState = (state: SessionState): void => {
    queryClient.setQueryData(key, state)
    invalidateDerived(queryClient, videoId, true)
  }

  return {
    save: async () => {
      try {
        const state = await enqueue(videoId, async () =>
          unwrap(await getApiClient().POST('/api/videos/{video_id}/session/save', params))
        )
        replaceState(state)
      } catch (error) {
        notifyError('Couldn’t save the analysis', error)
        throw error
      }
    },
    discard: async () => {
      const state = await enqueue(videoId, async () =>
        unwrap(await getApiClient().POST('/api/videos/{video_id}/session/discard', params))
      )
      replaceState(state)
    },
    startTracking: async () => {
      try {
        const job = await enqueue(videoId, async () =>
          unwrap(await getApiClient().POST('/api/videos/{video_id}/session/track', params))
        )
        queryClient.setQueryData(queryKeys.jobs.detail(job.id), job)
        queryClient.setQueryData<SessionState>(key, (s) => (s ? { ...s, active_job: job } : s))
        return job
      } catch (error) {
        notifyError('Couldn’t start tracking', error)
        return undefined
      }
    },
    cancelTracking: async (jobId) => {
      await cancelJob.mutateAsync(jobId)
    },
    applyTemplate: async (templateId) => {
      const before = queryClient.getQueryData<SessionState>(key)?.document.setup
      try {
        const state = await enqueue(videoId, async () =>
          unwrap(
            await getApiClient().POST('/api/videos/{video_id}/session/apply-template', {
              ...params,
              body: { template_id: templateId }
            })
          )
        )
        replaceState(state)
        if (before) {
          pushEdit({ kind: 'setup', label: 'Apply template', before, after: state.document.setup })
        }
      } catch (error) {
        notifyError('Couldn’t apply the template', error)
      }
    }
  }
}
