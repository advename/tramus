import { useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'

import type { Correction, FlagView } from '../../../api/types'
import { TERMINAL_JOB_STATES } from '../../../api/queries'
import { thumbnailUrl } from '../../../api/urls'
import { useShortcut } from '../../../lib/shortcuts'
import { formatClockTime, formatVideoTime } from '../../../lib/time'
import {
  useActiveJob,
  useCorrectionsEditor,
  useFlags,
  useIsTracked,
  useResults,
  useSession,
  useSetupEditor
} from '../data'
import { timeOfFrame, videoDuration } from '../lib/frames'
import { nextFlag } from '../lib/flags'
import { effectiveTrial } from '../lib/session'
import { useElementSize } from '../lib/useElementSize'
import { useVideoTiming } from '../playback/useVideoTiming'
import { type WorkspaceStep, useWorkspaceStore } from '../state/workspaceStore'
import { LABEL_COLUMN_WIDTH, TimelineTracks, type CorrectionMark, type ZoneLaneData } from './TimelineTracks'
import { TransportBar } from './TransportBar'
import { useTimelineDrag } from './useTimelineDrag'

export interface TimelineProps {
  videoId: string
  step: WorkspaceStep
}

/**
 * The timeline: transport row (play/pause, speed, trial start/end, zoom) and the tracks area
 * (ruler, trial handles, zone/flag/correction lanes, range selection). See
 * `designs/Workspace.dc.html` and `docs/architecture.md` §10.
 */
export function Timeline({ videoId, step }: TimelineProps): React.JSX.Element {
  const theme = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const rootSize = useElementSize(rootRef)

  const currentFrame = useWorkspaceStore((s) => s.currentFrame)
  const playing = useWorkspaceStore((s) => s.playing)
  const togglePlay = useWorkspaceStore((s) => s.togglePlay)
  const pause = useWorkspaceStore((s) => s.pause)
  const stepFrames = useWorkspaceStore((s) => s.stepFrames)
  const speed = useWorkspaceStore((s) => s.speed)
  const setSpeed = useWorkspaceStore((s) => s.setSpeed)
  const timelineZoom = useWorkspaceStore((s) => s.timelineZoom)
  const setTimelineZoom = useWorkspaceStore((s) => s.setTimelineZoom)
  const range = useWorkspaceStore((s) => s.range)
  const setRange = useWorkspaceStore((s) => s.setRange)
  const seek = useWorkspaceStore((s) => s.seek)
  const selectedFlagId = useWorkspaceStore((s) => s.selectedFlagId)
  const selectFlag = useWorkspaceStore((s) => s.selectFlag)

  const session = useSession(videoId)
  const recordedAt = session.data?.document.video.recorded_at ?? null
  const setupEditor = useSetupEditor(videoId)
  const correctionsEditor = useCorrectionsEditor(videoId)
  const isTracked = useIsTracked(videoId)
  const { data: flags } = useFlags(videoId)
  const { data: results } = useResults(videoId)
  const activeJob = useActiveJob(videoId)
  const frameTimes = useVideoTiming(videoId)

  const durationS = frameTimes ? videoDuration(frameTimes) : 0
  const currentTimeS = frameTimes ? timeOfFrame(frameTimes, currentFrame) : 0
  const trial = setupEditor.setup && frameTimes ? effectiveTrial(setupEditor.setup, frameTimes) : { start_s: 0, end_s: 0, locked_duration: false }

  const rangeEditable = step === 'review'
  const dragApi = useTimelineDrag({
    trackRef,
    durationS,
    frameTimes,
    trial,
    rangeEditable,
    setupEditor,
    onSeek: seek,
    onPauseForScrub: pause,
    onSetRange: setRange
  })

  const zoneLanes: ZoneLaneData[] = useMemo(() => {
    if (!isTracked || !setupEditor.setup) return []
    const byZone = new Map<string, { startS: number; endS: number }[]>()
    for (const visit of results?.visits ?? []) {
      const segs = byZone.get(visit.zone_id) ?? []
      segs.push({ startS: visit.enter_s, endS: visit.exit_s })
      byZone.set(visit.zone_id, segs)
    }
    return (setupEditor.setup.zones ?? []).map((zone) => ({
      zoneId: zone.id,
      name: zone.name,
      color: theme.palette.zones[zone.color_index % theme.palette.zones.length]!,
      segments: byZone.get(zone.id) ?? []
    }))
  }, [isTracked, setupEditor.setup, results, theme])

  const correctionMarks: CorrectionMark[] = useMemo(() => {
    if (!frameTimes) return []
    const marks: CorrectionMark[] = []
    for (const c of correctionsEditor.corrections) {
      marks.push(...correctionToMarks(c, frameTimes))
    }
    return marks
  }, [correctionsEditor.corrections, frameTimes])

  const processed =
    step === 'tracking' && activeJob && !TERMINAL_JOB_STATES.has(activeJob.state)
      ? { startS: trial.start_s, endS: trial.start_s + (trial.end_s - trial.start_s) * (activeJob.progress ?? 0) }
      : null

  const rangeSeconds =
    range && frameTimes ? { startS: timeOfFrame(frameTimes, range.start), endS: timeOfFrame(frameTimes, range.end) } : null
  const rangeText = rangeSeconds ? `${formatVideoTime(rangeSeconds.startS)}–${formatVideoTime(rangeSeconds.endS)}` : ''

  const handleFillRange = (): void => {
    if (!range) return
    void correctionsEditor.add({ kind: 'interpolate', frame_start: range.start, frame_end: range.end }, 'Fill in between')
    setRange(null)
  }
  const handleHideRange = (): void => {
    if (!range) return
    void correctionsEditor.add({ kind: 'mark_hidden', frame_start: range.start, frame_end: range.end }, 'Mouse not visible')
    setRange(null)
  }
  const handleFlagClick = (flag: FlagView): void => {
    pause()
    seek(flag.frame_start)
    selectFlag(flag.id)
  }

  const setTrialHere = (which: 'start' | 'end'): void => {
    const base = setupEditor.setup
    if (!base || !frameTimes) return
    const t = timeOfFrame(frameTimes, currentFrame)
    const current = effectiveTrial(base, frameTimes)
    const next =
      which === 'start'
        ? { ...current, start_s: Math.min(t, current.end_s - 0.01) }
        : { ...current, end_s: Math.max(t, current.start_s + 0.01) }
    void setupEditor.commit({ ...base, trial: next }, which === 'start' ? 'Set trial start' : 'Set trial end', base)
  }

  const trialEditable = step !== 'tracking' && step !== 'results'
  useShortcut('i', () => setTrialHere('start'), { enabled: trialEditable })
  useShortcut('o', () => setTrialHere('end'), { enabled: trialEditable })
  useShortcut(
    '[',
    () => {
      const target = nextFlag(flags ?? [], currentFrame, -1)
      if (target) handleFlagClick(target)
    },
    { enabled: step === 'review' }
  )
  useShortcut(
    ']',
    () => {
      const target = nextFlag(flags ?? [], currentFrame, 1)
      if (target) handleFlagClick(target)
    },
    { enabled: step === 'review' }
  )
  useShortcut('n', () => (range ? handleHideRange() : undefined), { enabled: step === 'review' })
  useShortcut('f', () => (range ? handleFillRange() : undefined), { enabled: step === 'review' })
  useShortcut('escape', () => (range ? setRange(null) : undefined), { enabled: step === 'review', preventDefault: false })

  const pxPerSecond = durationS > 0 ? (Math.max(0, rootSize.width - LABEL_COLUMN_WIDTH) * timelineZoom) / durationS : 0

  return (
    <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', userSelect: 'none' }}>
      <TransportBar
        playing={playing}
        onTogglePlay={togglePlay}
        onStepFrame={stepFrames}
        speed={speed}
        onSpeedChange={setSpeed}
        timeS={currentTimeS}
        durationS={durationS}
        clockLabel={recordedAt ? `${formatClockTime(recordedAt, currentTimeS, { ms: true })} local` : null}
        onSetStartHere={() => setTrialHere('start')}
        onSetEndHere={() => setTrialHere('end')}
        startS={trial.start_s}
        endS={trial.end_s}
        locked={trial.locked_duration}
        onToggleLock={() => {
          const base = setupEditor.setup
          if (!base || !frameTimes) return
          const current = effectiveTrial(base, frameTimes)
          void setupEditor.commit(
            { ...base, trial: { ...current, locked_duration: !current.locked_duration } },
            current.locked_duration ? 'Unlock trial duration' : 'Lock trial duration',
            base
          )
        }}
        zoom={timelineZoom}
        onZoomChange={setTimelineZoom}
      />
      <TimelineTracks
        trackRef={trackRef}
        onTrackPointerDown={dragApi.onTrackPointerDown}
        zoom={timelineZoom}
        pxPerSecond={pxPerSecond}
        durationS={durationS}
        currentTimeS={currentTimeS}
        trial={trial}
        zoneLanes={zoneLanes}
        showZoneLanes={isTracked}
        flags={flags ?? []}
        showFlagLane={isTracked}
        selectedFlagId={selectedFlagId}
        onFlagClick={handleFlagClick}
        correctionMarks={correctionMarks}
        processed={processed}
        filmstripUrl={frameTimes && frameTimes.length > 0 ? thumbnailUrl(videoId, { maxSide: 200 }) : null}
        range={rangeSeconds}
        rangeText={rangeText}
        rangeEditable={rangeEditable}
        onFillRange={handleFillRange}
        onHideRange={handleHideRange}
        onClearRange={() => setRange(null)}
      />
    </Box>
  )
}

function correctionToMarks(correction: Correction, frameTimes: Float64Array): CorrectionMark[] {
  if (correction.kind === 'set_position') {
    const t = timeOfFrame(frameTimes, correction.frame)
    return [{ startS: t, endS: t, title: 'Set position' }]
  }
  if (correction.kind === 'mark_hidden') {
    return [
      {
        startS: timeOfFrame(frameTimes, correction.frame_start),
        endS: timeOfFrame(frameTimes, correction.frame_end),
        title: 'Mouse not visible'
      }
    ]
  }
  if (correction.kind === 'interpolate') {
    return [
      {
        startS: timeOfFrame(frameTimes, correction.frame_start),
        endS: timeOfFrame(frameTimes, correction.frame_end),
        title: 'Fill in between'
      }
    ]
  }
  return []
}
