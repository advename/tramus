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
import { TIMELINE_GUTTER_PX } from '../lib/timelineScale'
import {
  LABEL_COLUMN_WIDTH,
  TimelineTracks,
  type CorrectionMark,
  type ZoneLaneData
} from './TimelineTracks'
import { TransportBar } from './TransportBar'
import { useTimelineDrag } from './useTimelineDrag'

export interface TimelineProps {
  videoId: string
  step: WorkspaceStep
  /** Total panel height (px) — the user-resizable divider lives in `WorkspacePage`. */
  height: number
}

/** Fixed rows above the lanes: the ruler + the video filmstrip strip, plus the tracks' bottom padding. */
const RULER_HEIGHT = 20
const VIDEO_STRIP_HEIGHT = 34
const TRACKS_BOTTOM_PADDING = 6
const MIN_LANE_ROW_HEIGHT = 16
const MAX_LANE_ROW_HEIGHT = 30

/**
 * The timeline: transport row (play/pause, speed, trial start/end, zoom) and the tracks area
 * (ruler, trial handles, zone/flag/correction lanes, range selection). See
 * `designs/Workspace.dc.html` and `docs/architecture.md` §10. `height` is user-resizable (the
 * divider above this panel lives in `WorkspacePage`); the extra room goes to the zone/flag/
 * correction lanes, up to `MAX_LANE_ROW_HEIGHT`, then the tracks area scrolls vertically.
 */
export function Timeline({ videoId, step, height }: TimelineProps): React.JSX.Element {
  const theme = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const tracksAreaRef = useRef<HTMLDivElement>(null)
  const rootSize = useElementSize(rootRef)
  const tracksAreaSize = useElementSize(tracksAreaRef)

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
  const trial =
    setupEditor.setup && frameTimes
      ? effectiveTrial(setupEditor.setup, frameTimes)
      : { start_s: 0, end_s: 0, locked_duration: false }

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
      ? {
          startS: trial.start_s,
          endS: trial.start_s + (trial.end_s - trial.start_s) * (activeJob.progress ?? 0)
        }
      : null

  const rangeSeconds =
    range && frameTimes
      ? { startS: timeOfFrame(frameTimes, range.start), endS: timeOfFrame(frameTimes, range.end) }
      : null
  const rangeText = rangeSeconds
    ? `${formatVideoTime(rangeSeconds.startS)}–${formatVideoTime(rangeSeconds.endS)}`
    : ''

  const handleFillRange = (): void => {
    if (!range) return
    void correctionsEditor.add(
      { kind: 'interpolate', frame_start: range.start, frame_end: range.end },
      'Fill in between'
    )
    setRange(null)
  }
  const handleHideRange = (): void => {
    if (!range) return
    void correctionsEditor.add(
      { kind: 'mark_hidden', frame_start: range.start, frame_end: range.end },
      'Mouse not visible'
    )
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
    void setupEditor.commit(
      { ...base, trial: next },
      which === 'start' ? 'Set trial start' : 'Set trial end',
      base
    )
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
  useShortcut('escape', () => (range ? setRange(null) : undefined), {
    enabled: step === 'review',
    preventDefault: false
  })

  // Usable width mirrors `TimelineTracks`' rendered gutter (`percentOfDuration`/`widthOfDuration`)
  // so tick spacing lines up with where ticks actually land.
  const trackWidth = Math.max(0, rootSize.width - LABEL_COLUMN_WIDTH) * timelineZoom
  const pxPerSecond =
    durationS > 0 ? Math.max(0, trackWidth - 2 * TIMELINE_GUTTER_PX) / durationS : 0

  // Extra panel height (from the resize divider) grows the lane rows first, up to a cap; beyond
  // that the tracks area scrolls vertically (see the `overflowY: auto` on its grid in
  // `TimelineTracks`).
  const laneCount = zoneLanes.length + (isTracked ? 2 : 0)
  const lanesAvailable =
    tracksAreaSize.height - RULER_HEIGHT - VIDEO_STRIP_HEIGHT - TRACKS_BOTTOM_PADDING
  const laneRowHeight =
    laneCount > 0
      ? Math.min(MAX_LANE_ROW_HEIGHT, Math.max(MIN_LANE_ROW_HEIGHT, lanesAvailable / laneCount))
      : MIN_LANE_ROW_HEIGHT

  return (
    <Box
      ref={rootRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        userSelect: 'none'
      }}
    >
      <Box sx={{ flex: '0 0 auto' }}>
        <TransportBar
          playing={playing}
          onTogglePlay={togglePlay}
          onStepFrame={stepFrames}
          speed={speed}
          onSpeedChange={setSpeed}
          timeS={currentTimeS}
          durationS={durationS}
          clockLabel={
            recordedAt ? `${formatClockTime(recordedAt, currentTimeS, { ms: true })} local` : null
          }
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
      </Box>
      <Box ref={tracksAreaRef} sx={{ flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
        <TimelineTracks
          trackRef={trackRef}
          onTrackPointerDown={dragApi.onTrackPointerDown}
          zoom={timelineZoom}
          pxPerSecond={pxPerSecond}
          laneRowHeight={laneRowHeight}
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
          filmstripUrl={
            frameTimes && frameTimes.length > 0 ? thumbnailUrl(videoId, { maxSide: 200 }) : null
          }
          range={rangeSeconds}
          rangeText={rangeText}
          rangeEditable={rangeEditable}
          onFillRange={handleFillRange}
          onHideRange={handleHideRange}
          onClearRange={() => setRange(null)}
        />
      </Box>
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
