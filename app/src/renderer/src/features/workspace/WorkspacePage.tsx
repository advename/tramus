import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

import { useFrameTimes, useSettings } from '../../api/queries'
import { EmptyState } from '../../components/EmptyState'
import { formatDate } from '../../lib/time'
import { useShortcut } from '../../lib/shortcuts'
import { notify } from '../../stores/notifications'
import { FileChangedCard } from './dialogs/FileChangedCard'
import { NoSetupCard } from './dialogs/NoSetupCard'
import { TrackingProgressCard } from './dialogs/TrackingProgressCard'
import { TrackingStoppedCard } from './dialogs/TrackingStoppedCard'
import { UnsavedChangesDialog } from './dialogs/UnsavedChangesDialog'
import {
  useActiveJob,
  useFlags,
  useHistory,
  useIsTracked,
  useResults,
  useSession,
  useSessionActions,
  useSetupEditor,
  useUndoRedo
} from './data'
import { Inspector } from './inspector/Inspector'
import { LoadTemplateMenu } from './inspector/LoadTemplateMenu'
import { isSetupEmpty, saveLabel } from './lib/session'
import { ResultsView } from './results/ResultsView'
import { VideoStage } from './stage/VideoStage'
import { useWorkspaceStore, type WorkspaceStep } from './state/workspaceStore'
import { Timeline } from './timeline/Timeline'
import {
  clampTimelineHeight,
  DEFAULT_TIMELINE_HEIGHT,
  loadTimelineHeight,
  saveTimelineHeight
} from './timeline/timelineLayout'
import { WorkspaceTopBar } from './topbar/WorkspaceTopBar'

const TERMINAL_JOB_STATES = new Set(['succeeded', 'failed', 'cancelled'])

/**
 * The video workspace: top bar, video stage / results, inspector and timeline, laid out per
 * `designs/Workspace.dc.html`. Step is driven by the URL (`/videos/:videoId/:step`).
 */
export function WorkspacePage(): React.JSX.Element {
  const { videoId, step: rawStep } = useParams<{ videoId: string; step: WorkspaceStep }>()
  const step: WorkspaceStep = rawStep ?? 'setup'
  const navigate = useNavigate()

  if (!videoId) {
    return <EmptyState icon="movie" title="No video selected" />
  }

  return <OpenWorkspace videoId={videoId} step={step} navigate={navigate} />
}

interface OpenWorkspaceProps {
  videoId: string
  step: WorkspaceStep
  navigate: ReturnType<typeof useNavigate>
}

function OpenWorkspace({ videoId, step, navigate }: OpenWorkspaceProps): React.JSX.Element {
  const settings = useSettings()
  const session = useSession(videoId)
  const frameTimes = useFrameTimes(videoId)
  const isTracked = useIsTracked(videoId)
  const activeJob = useActiveJob(videoId)
  const flags = useFlags(videoId)
  const history = useHistory(videoId)
  const results = useResults(videoId)

  const setupEditor = useSetupEditor(videoId)
  const sessionActions = useSessionActions(videoId)
  const undoRedo = useUndoRedo(videoId)

  const open = useWorkspaceStore((s) => s.open)
  const setFrameCount = useWorkspaceStore((s) => s.setFrameCount)
  const setSpeed = useWorkspaceStore((s) => s.setSpeed)
  const setSetupTool = useWorkspaceStore((s) => s.setSetupTool)
  const setupHintDismissed = useWorkspaceStore((s) => s.setupHintDismissed)

  const [saving, setSaving] = useState(false)
  const [fileChangedDismissed, setFileChangedDismissed] = useState(false)
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<HTMLElement | null>(null)
  const [timelineHeight, setTimelineHeight] = useState(() =>
    clampTimelineHeight(loadTimelineHeight(), window.innerHeight)
  )
  const [resizingTimeline, setResizingTimeline] = useState(false)

  const openedVideoRef = useRef<string | null>(null)
  const loadedNotifiedRef = useRef<string | null>(null)
  const setupChangesCountRef = useRef<number | null>(null)
  const jobStateRef = useRef<string | undefined>(undefined)

  // Open the video (once per video, as soon as playback defaults are known).
  useEffect(() => {
    if (openedVideoRef.current === videoId || !settings.data) return
    openedVideoRef.current = videoId
    setFileChangedDismissed(false)
    open(videoId, {
      speed: step === 'review' || step === 'results' ? settings.data.review_playback_speed : 1,
      trailLengthS: settings.data.trail_length_s
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, settings.data])

  useEffect(() => {
    if (frameTimes.data) setFrameCount(frameTimes.data.length)
  }, [frameTimes.data, setFrameCount])

  // Re-clamp a persisted timeline height if the window shrinks below what it allows.
  useEffect(() => {
    const onResize = (): void =>
      setTimelineHeight((h) => clampTimelineHeight(h, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onTimelineDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = timelineHeight
    setResizingTimeline(true)
    const onMove = (ev: PointerEvent): void => {
      setTimelineHeight(
        clampTimelineHeight(startHeight - (ev.clientY - startY), window.innerHeight)
      )
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setResizingTimeline(false)
      setTimelineHeight((h) => {
        saveTimelineHeight(h)
        return h
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onTimelineDividerDoubleClick = (): void => {
    const next = clampTimelineHeight(DEFAULT_TIMELINE_HEIGHT, window.innerHeight)
    setTimelineHeight(next)
    saveTimelineHeight(next)
  }

  const setup = session.data?.document.setup
  const setupEmpty = isSetupEmpty(setup)

  // Steps after Setup are disabled while the setup is empty.
  useEffect(() => {
    if (!session.data || step === 'setup') return
    if (setupEmpty) void navigate(`/videos/${videoId}/setup`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data, step, setupEmpty, videoId])

  // Opening `tracking` with no active job redirects to setup (or review if already tracked).
  useEffect(() => {
    if (!session.data || step !== 'tracking') return
    if (!session.data.active_job) {
      void navigate(`/videos/${videoId}/${isTracked ? 'review' : 'setup'}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data?.active_job, step, isTracked, videoId])

  // Review and Results play at the review speed (default 4×); Setup and Tracking at 1×. Applied on
  // every step change, however it happened (step tabs, tracking finishing, a redirect).
  const previousStepRef = useRef<WorkspaceStep | null>(null)
  useEffect(() => {
    const isReviewing = (s: WorkspaceStep | null): boolean => s === 'review' || s === 'results'
    const previous = previousStepRef.current
    previousStepRef.current = step
    if (previous === null || isReviewing(previous) === isReviewing(step) || !settings.data) return
    setSpeed(isReviewing(step) ? settings.data.review_playback_speed : 1)
  }, [step, settings.data, setSpeed])

  // When the active job succeeds, move on to Review.
  useEffect(() => {
    if (
      step === 'tracking' &&
      activeJob?.state === 'succeeded' &&
      jobStateRef.current !== 'succeeded'
    ) {
      void navigate(`/videos/${videoId}/review`, { replace: true })
    }
    jobStateRef.current = activeJob?.state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.state, step, videoId])

  // "Loaded analysis saved on …" snackbar, once per opened video.
  useEffect(() => {
    if (!session.data || loadedNotifiedRef.current === videoId) return
    if (session.data.loaded_from_disk) {
      loadedNotifiedRef.current = videoId
      notify({
        severity: 'success',
        icon: 'history',
        title: session.data.saved_at
          ? `Loaded analysis saved on ${formatDate(session.data.saved_at)}`
          : 'Loaded analysis',
        message: 'Setup, track, corrections and flag decisions were restored.'
      })
    }
  }, [session.data, videoId])

  // "Results updated" snackbar when a zone is edited after tracking.
  useEffect(() => {
    const count = session.data?.document.setup_changes.length
    if (count == null) return
    if (setupChangesCountRef.current != null && count > setupChangesCountRef.current && isTracked) {
      notify({
        severity: 'success',
        icon: 'refresh',
        title: 'Results updated',
        message: 'Zone times were recalculated from the existing track. No re-tracking needed.',
        action: { label: 'Undo', onClick: () => undoRedo.undo() }
      })
    }
    setupChangesCountRef.current = count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data?.document.setup_changes.length, isTracked])

  const onTrack = async (): Promise<void> => {
    if (setupEmpty) return
    const job = await sessionActions.startTracking()
    if (job) void navigate(`/videos/${videoId}/tracking`)
  }
  const onSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await sessionActions.save()
    } finally {
      setSaving(false)
    }
  }

  useShortcut('mod+s', () => void onSave())
  useShortcut('mod+z', () => undoRedo.undo())
  useShortcut('mod+shift+z', () => undoRedo.redo())
  useShortcut('mod+t', () => void onTrack())
  useShortcut(
    'esc',
    () => {
      if (activeJob && !TERMINAL_JOB_STATES.has(activeJob.state)) {
        void sessionActions.cancelTracking(activeJob.id)
      }
    },
    { enabled: step === 'tracking' }
  )

  if (session.isError) {
    return (
      <EmptyState
        icon="error"
        title="Couldn’t open this video"
        description={session.error instanceof Error ? session.error.message : undefined}
      />
    )
  }

  if (!session.data || !settings.data) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  const sessionData = session.data
  const allFlags = flags.data ?? []

  let statusCards: React.ReactNode = null
  if (step === 'setup') {
    statusCards = (
      <>
        {sessionData.file_changed && !fileChangedDismissed ? (
          <FileChangedCard
            onKeep={() => setFileChangedDismissed(true)}
            onRetrack={() => void onTrack()}
          />
        ) : null}
        {setupEmpty && !setupHintDismissed ? (
          <NoSetupCard
            onDrawArena={() => setSetupTool('arena')}
            onLoadTemplate={(anchor) => setTemplateMenuAnchor(anchor)}
          />
        ) : null}
      </>
    )
  } else if (step === 'tracking') {
    if (activeJob && (activeJob.state === 'running' || activeJob.state === 'queued')) {
      statusCards = (
        <TrackingProgressCard
          job={activeJob}
          onCancel={() => void sessionActions.cancelTracking(activeJob.id)}
        />
      )
    } else if (activeJob?.state === 'failed') {
      statusCards = (
        <TrackingStoppedCard
          kind="failed"
          errorMessage={activeJob.error}
          onRetry={() => void onTrack()}
          onBackToSetup={() => void navigate(`/videos/${videoId}/setup`)}
        />
      )
    } else if (activeJob?.state === 'cancelled') {
      statusCards = (
        <TrackingStoppedCard
          kind="cancelled"
          onRetry={() => void onTrack()}
          onBackToSetup={() => void navigate(`/videos/${videoId}/setup`)}
        />
      )
    }
  }

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}
    >
      <WorkspaceTopBar
        videoPath={sessionData.video.path}
        fileName={sessionData.video.file_name}
        recordedAt={sessionData.document.video.recorded_at}
        step={step}
        disabledAfterSetup={setupEmpty}
        onSelectStep={(s) => void navigate(`/videos/${videoId}/${s}`)}
        save={saveLabel(sessionData)}
        onSave={() => void onSave()}
        saving={saving}
      />
      <Box
        sx={{
          flex: '1 1 0',
          minHeight: 0,
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 312px'
        }}
      >
        {step === 'results' ? (
          <Box sx={{ position: 'relative', minWidth: 0, minHeight: 0, bgcolor: 'canvas' }}>
            <ResultsView videoId={videoId} />
          </Box>
        ) : (
          <VideoStage videoId={videoId} step={step}>
            {statusCards}
          </VideoStage>
        )}
        <Inspector
          videoId={videoId}
          step={step}
          session={sessionData}
          setupEditor={setupEditor}
          sessionActions={sessionActions}
          flags={allFlags}
          history={history.data ?? []}
          results={results.data ?? null}
          onTrack={() => void onTrack()}
          trackDisabled={setupEmpty}
        />
      </Box>
      <Box
        onPointerDown={onTimelineDividerPointerDown}
        onDoubleClick={onTimelineDividerDoubleClick}
        title="Drag to resize the timeline — double-click to reset"
        sx={{
          flex: 'none',
          height: 7,
          display: 'flex',
          alignItems: 'center',
          cursor: 'row-resize',
          '&:hover > .timeline-divider-line': { bgcolor: 'primary.main' }
        }}
      >
        <Box
          className="timeline-divider-line"
          sx={{
            width: '100%',
            height: '1px',
            bgcolor: resizingTimeline ? 'primary.main' : 'divider'
          }}
        />
      </Box>
      <Timeline videoId={videoId} step={step} height={timelineHeight} />

      <LoadTemplateMenu
        anchorEl={templateMenuAnchor}
        onClose={() => setTemplateMenuAnchor(null)}
        onSelect={(templateId) => void sessionActions.applyTemplate(templateId)}
      />

      <UnsavedChangesDialog
        videoId={videoId}
        dirty={sessionData.dirty}
        fileName={sessionData.video.file_name}
        onSave={onSave}
        onDiscard={sessionActions.discard}
      />
    </Box>
  )
}
