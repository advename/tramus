import { useMemo, useRef } from 'react'
import Box from '@mui/material/Box'

import type { Setup } from '../../../api/types'
import { useShortcut } from '../../../lib/shortcuts'
import {
  useCorrectionsEditor,
  useDetectionPreview,
  useIsTracked,
  useResults,
  useSession,
  useSetupEditor,
  useTrackData,
  useUndoRedo,
  useFlags
} from '../data'
import { isVisible } from '../data/trackData'
import { frameAtTime, timeOfFrame } from '../lib/frames'
import { flagAtFrame, useReopenFlag } from '../lib/flags'
import { distance } from '../lib/geometry'
import { formatVideoTime } from '../../../lib/time'
import { computeStageTransform, computeViewBox, svgPointFromClient } from '../lib/stageTransform'
import { buildHeatmapPoints, buildTrailSegments } from '../lib/trail'
import { useElementSize } from '../lib/useElementSize'
import { useFrameBitmap } from '../playback/useFrameBitmap'
import { useImageBitmap } from '../playback/useImageBitmap'
import { usePlaybackClock } from '../playback/usePlaybackClock'
import { useVideoTiming } from '../playback/useVideoTiming'
import { type WorkspaceStep, useWorkspaceStore } from '../state/workspaceStore'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { CalibrationPopover } from './CalibrationPopover'
import { FlagBanner } from './FlagBanner'
import { OverlayToggles } from './OverlayToggles'
import { StageCanvas } from './StageCanvas'
import { StageOverlay } from './StageOverlay'
import { StatusBar } from './StatusBar'
import { ToolPalette } from './ToolPalette'
import { useStagePanZoom } from './useStagePanZoom'
import { ViewToggle } from './ViewToggle'
import { useZoneEditing } from './useZoneEditing'

export interface VideoStageProps {
  videoId: string
  step: WorkspaceStep
  /** Status cards drawn centred over the stage (tracking progress, errors, empty-setup hint). */
  children?: React.ReactNode
}

const EMPTY_SETUP: Setup = {}
const STAGE_PADDING = { top: 48, right: 52, bottom: 30, left: 60 }

/**
 * The video stage: the frame canvas, the SVG overlay (arena, zones, handles, trail, heatmap, body
 * outline), the floating tool palette, view/overlay toggles, the flag banner and the status
 * readout. See `docs/architecture.md` §10 and `designs/Workspace.dc.html`.
 */
export function VideoStage({ videoId, step, children }: VideoStageProps): React.JSX.Element {
  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const container = useElementSize(containerRef)

  // Store — narrow selectors so unrelated state changes don't re-render this whole tree.
  const currentFrame = useWorkspaceStore((s) => s.currentFrame)
  const playing = useWorkspaceStore((s) => s.playing)
  const setupTool = useWorkspaceStore((s) => s.setupTool)
  const reviewTool = useWorkspaceStore((s) => s.reviewTool)
  const setSetupTool = useWorkspaceStore((s) => s.setSetupTool)
  const setReviewTool = useWorkspaceStore((s) => s.setReviewTool)
  const selection = useWorkspaceStore((s) => s.selection)
  const stageView = useWorkspaceStore((s) => s.stageView)
  const setStageView = useWorkspaceStore((s) => s.setStageView)
  const toggleStageView = useWorkspaceStore((s) => s.toggleStageView)
  const stageZoom = useWorkspaceStore((s) => s.stageZoom)
  const stagePan = useWorkspaceStore((s) => s.stagePan)
  const overlays = useWorkspaceStore((s) => s.overlays)
  const toggleOverlay = useWorkspaceStore((s) => s.toggleOverlay)
  const trailLengthS = useWorkspaceStore((s) => s.trailLengthS)
  const setTrailLength = useWorkspaceStore((s) => s.setTrailLength)
  const inspectorTab = useWorkspaceStore((s) => s.inspectorTab)
  const frameCount = useWorkspaceStore((s) => s.frameCount)
  const togglePlay = useWorkspaceStore((s) => s.togglePlay)
  const stepFrames = useWorkspaceStore((s) => s.stepFrames)
  const seek = useWorkspaceStore((s) => s.seek)
  const pause = useWorkspaceStore((s) => s.pause)

  // Server data.
  const session = useSession(videoId)
  const videoInfo = session.data?.document.video
  const video = useMemo(
    () => ({ width: videoInfo?.width ?? 0, height: videoInfo?.height ?? 0 }),
    [videoInfo?.width, videoInfo?.height]
  )
  const setupEditor = useSetupEditor(videoId)
  const correctionsEditor = useCorrectionsEditor(videoId)
  const undoRedo = useUndoRedo(videoId)
  const isTracked = useIsTracked(videoId)
  const { data: trackData } = useTrackData(videoId)
  const { data: flags } = useFlags(videoId)
  const { data: results } = useResults(videoId)
  const frameTimes = useVideoTiming(videoId)
  usePlaybackClock(frameTimes)

  const setup = setupEditor.setup
  const image = setup?.image
  const brightness = image?.brightness ?? 0
  const contrast = image?.contrast ?? 0

  // Stage transform (shared by the canvas and the SVG overlay).
  const transform = useMemo(
    () => computeStageTransform({ container, video, zoom: stageZoom, pan: stagePan }),
    [container, video, stageZoom, stagePan]
  )
  const viewBox = useMemo(() => computeViewBox(transform, container), [transform, container])
  const panZoom = useStagePanZoom(container, video)

  // Frame source: the video frame, or (tracker view) the detection-preview mask.
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const maxSide = Math.max(
    1,
    Math.min(
      Math.max(video.width, video.height) || 2048,
      Math.round(Math.max(video.width, video.height) * transform.scale * dpr) || 2048
    )
  )
  const videoBitmap = useFrameBitmap(
    videoId,
    currentFrame,
    { maxSide, brightness, contrast, quality: 82 },
    { enabled: stageView === 'video' && playing, frameCount }
  )
  const detectionEnabled =
    stageView === 'tracker' && (step === 'setup' || step === 'tracking') && Boolean(setup)
  const detectionPreview = useDetectionPreview(
    videoId,
    currentFrame,
    setup ?? EMPTY_SETUP,
    detectionEnabled
  )
  const maskBitmap = useImageBitmap(
    detectionPreview.data ? `data:image/png;base64,${detectionPreview.data.mask_png}` : null
  )
  const bitmap = stageView === 'tracker' ? maskBitmap : videoBitmap

  // Review overlays, built from the typed-array track (no per-frame allocation of big arrays).
  const tracked = isTracked && step !== 'setup'
  const needsTrailWindow = tracked && (overlays.trail || overlays.heatmap) && step === 'review'
  const trailSegments = useMemo(
    () =>
      needsTrailWindow && trackData
        ? buildTrailSegments(trackData, currentFrame, trailLengthS)
        : [],
    [needsTrailWindow, trackData, currentFrame, trailLengthS]
  )
  const heatmapPoints = useMemo(
    () =>
      needsTrailWindow && trackData
        ? buildHeatmapPoints(trackData, currentFrame, trailLengthS)
        : [],
    [needsTrailWindow, trackData, currentFrame, trailLengthS]
  )
  const bodyEllipse = useMemo(() => {
    if (!trackData || !isVisible(trackData, currentFrame)) return null
    return {
      x: trackData.x[currentFrame]!,
      y: trackData.y[currentFrame]!,
      semiMajor: trackData.semiMajor[currentFrame]!,
      semiMinor: trackData.semiMinor[currentFrame]!,
      angleDeg: trackData.angleDeg[currentFrame]!
    }
  }, [trackData, currentFrame])
  const activeZoneIds = useMemo(() => {
    const ids = new Set<string>()
    if (!results) return ids
    for (const visit of results.visits) {
      if (currentFrame >= visit.frame_enter && currentFrame <= visit.frame_exit)
        ids.add(visit.zone_id)
    }
    return ids
  }, [results, currentFrame])

  const positionMarker = useMemo(() => {
    if (step !== 'review' || !frameTimes) return null
    const correction = [...correctionsEditor.corrections]
      .reverse()
      .find((c) => c.kind === 'set_position' && c.frame === currentFrame)
    if (!correction || correction.kind !== 'set_position') return null
    return {
      x: correction.x,
      y: correction.y,
      label: `set at ${formatVideoTime(timeOfFrame(frameTimes, currentFrame))}`
    }
  }, [step, frameTimes, correctionsEditor.corrections, currentFrame])

  const currentFlag = step === 'review' ? flagAtFrame(flags ?? [], currentFrame) : undefined
  const reopenFlag = useReopenFlag(correctionsEditor)

  // Zone/arena editing (select, move, resize, draw, delete).
  const zoneEditing = useZoneEditing(svgRef, step, setupEditor)
  const showHandles = step === 'setup' || (step === 'review' && inspectorTab === 'zones')

  const handlePositionClick = (e: React.PointerEvent<SVGSVGElement>): void => {
    const svg = svgRef.current
    if (!svg) return
    const p = svgPointFromClient(svg, e.clientX, e.clientY)
    void correctionsEditor.add(
      { kind: 'set_position', frame: currentFrame, x: Math.round(p.x), y: Math.round(p.y) },
      'Set position'
    )
  }

  const handleBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (panZoom.tryStartPan(e)) return
    if (step === 'review' && reviewTool === 'position') {
      handlePositionClick(e)
      return
    }
    zoneEditing.onBackgroundPointerDown(e)
  }

  const activeTool = zoneEditing.activeTool
  const cursor =
    panZoom.cursor ??
    (activeTool === 'position' ||
    ['arena', 'rect', 'ellipse', 'polygon', 'measure'].includes(activeTool)
      ? 'crosshair'
      : 'default')

  // Shortcuts (active only while this step's stage is mounted — see class doc for the full list).
  useShortcut('space', () => togglePlay())
  useShortcut('arrowleft', () => stepFrames(-1))
  useShortcut('arrowright', () => stepFrames(1))
  useShortcut(
    'shift+arrowleft',
    () => {
      if (!frameTimes) return
      pause()
      seek(frameAtTime(frameTimes, timeOfFrame(frameTimes, currentFrame) - 1))
    },
    { preventDefault: true }
  )
  useShortcut(
    'shift+arrowright',
    () => {
      if (!frameTimes) return
      pause()
      seek(frameAtTime(frameTimes, timeOfFrame(frameTimes, currentFrame) + 1))
    },
    { preventDefault: true }
  )
  useShortcut('mod+=', () => panZoom.zoomBy(1.5))
  useShortcut('mod+-', () => panZoom.zoomBy(1 / 1.5))
  useShortcut('mod+0', () => panZoom.zoomFit())
  useShortcut('b', () => toggleStageView(), { enabled: step === 'setup' || step === 'tracking' })
  useShortcut('t', () => toggleOverlay('trail'), { enabled: step === 'review' })
  useShortcut('m', () => toggleOverlay('heatmap'), { enabled: step === 'review' })
  useShortcut('l', () => toggleOverlay('outline'), { enabled: step === 'review' })
  useShortcut('z', () => toggleOverlay('currentZone'), { enabled: step === 'review' })
  useShortcut(
    'a',
    () => {
      if (currentFlag?.status === 'unresolved') {
        void correctionsEditor.add(
          { kind: 'accept_flag', flag_id: currentFlag.id },
          'Accepted flag'
        )
      }
    },
    { enabled: step === 'review' }
  )
  useShortcut('delete', () => zoneEditing.deleteSelectedZone(), { enabled: zoneEditing.editable })
  useShortcut('backspace', () => zoneEditing.deleteSelectedZone(), {
    enabled: zoneEditing.editable
  })
  useShortcut('escape', () => zoneEditing.cancelDrawing(), {
    enabled: step === 'setup' || step === 'review',
    preventDefault: false
  })
  useShortcut('v', () => (step === 'setup' ? setSetupTool('select') : setReviewTool('select')), {
    enabled: step === 'setup' || step === 'review'
  })
  useShortcut('a', () => setSetupTool('arena'), { enabled: step === 'setup' })
  useShortcut('r', () => setSetupTool('rect'), { enabled: step === 'setup' })
  useShortcut('e', () => setSetupTool('ellipse'), { enabled: step === 'setup' })
  useShortcut('g', () => setSetupTool('polygon'), { enabled: step === 'setup' })
  // Setup-only: doesn't clash with Review's 'm' (toggle heatmap, line 241) — they're never both enabled.
  useShortcut('m', () => setSetupTool('measure'), { enabled: step === 'setup' })
  useShortcut('h', () => (step === 'setup' ? setSetupTool('pan') : setReviewTool('pan')), {
    enabled: step === 'setup' || step === 'review'
  })
  useShortcut('p', () => setReviewTool('position'), { enabled: step === 'review' })

  return (
    <Box
      ref={outerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        bgcolor: 'canvas',
        overflow: 'hidden'
      }}
    >
      <Box
        ref={containerRef}
        onWheel={panZoom.onWheel}
        sx={{
          position: 'absolute',
          inset: 0,
          pt: `${STAGE_PADDING.top}px`,
          pr: `${STAGE_PADDING.right}px`,
          pb: `${STAGE_PADDING.bottom}px`,
          pl: `${STAGE_PADDING.left}px`
        }}
      >
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          <StageCanvas
            container={container}
            video={video}
            transform={transform}
            bitmap={bitmap}
            filter="none"
          />
          <StageOverlay
            svgRef={svgRef}
            viewBox={viewBox}
            cursor={cursor}
            video={video}
            setup={setup}
            selection={selection}
            editing={zoneEditing}
            showHandles={showHandles}
            stageView={stageView}
            tracked={tracked}
            overlays={overlays}
            activeZoneIds={activeZoneIds}
            trailSegments={trailSegments}
            heatmapPoints={heatmapPoints}
            bodyEllipse={overlays.outline ? bodyEllipse : null}
            positionMarker={positionMarker}
            detectionObservation={
              stageView === 'tracker' ? (detectionPreview.data?.observation ?? null) : null
            }
            detectionBlobAreaLabel={
              detectionPreview.data?.observation
                ? `${Math.round(detectionPreview.data.observation.area_px)} px²`
                : null
            }
            calibration={step === 'setup' ? (setup?.calibration ?? null) : null}
            measureDraft={step === 'setup' ? zoneEditing.measureDraft : null}
            px={1 / transform.scale}
            onBackgroundPointerDown={handleBackgroundPointerDown}
            onCalibrationHandlePointerDown={zoneEditing.onCalibrationHandlePointerDown}
          />
        </Box>
      </Box>

      <ToolPalette
        step={step}
        setupTool={setupTool}
        reviewTool={reviewTool}
        onSetupTool={setSetupTool}
        onReviewTool={setReviewTool}
        undoRedo={step === 'review' ? undoRedo : undefined}
        onZoomIn={() => panZoom.zoomBy(1.5)}
        onZoomOut={() => panZoom.zoomBy(1 / 1.5)}
        onZoomFit={() => panZoom.zoomFit()}
      />

      {(step === 'setup' || step === 'tracking') && (
        <ViewToggle view={stageView} onChange={setStageView} />
      )}

      {step === 'review' && (
        <OverlayToggles
          overlays={overlays}
          onToggle={toggleOverlay}
          trailLengthS={trailLengthS}
          onTrailLengthChange={setTrailLength}
        />
      )}

      <StatusBar
        svgRef={svgRef}
        zoomPercent={Math.round(stageZoom * 100)}
        frame={currentFrame}
        frameCount={frameCount}
        videoWidth={video.width}
        videoHeight={video.height}
        nominalFps={videoInfo?.nominal_fps ?? 0}
      />

      {currentFlag && flags && (
        <FlagBanner
          flag={currentFlag}
          index={flags.findIndex((f) => f.id === currentFlag.id)}
          total={flags.length}
          timeS={currentFlag.t_start_s}
          onAccept={() =>
            void correctionsEditor.add(
              { kind: 'accept_flag', flag_id: currentFlag.id },
              'Accepted flag'
            )
          }
          onSetPosition={() => setReviewTool('position')}
          onReopen={() => reopenFlag.request(currentFlag)}
        />
      )}

      <ConfirmDialog
        open={reopenFlag.pending != null}
        title="Reopen flag"
        description={reopenFlag.description}
        confirmLabel="Reopen"
        onConfirm={reopenFlag.confirm}
        onCancel={reopenFlag.cancel}
      />

      {step === 'setup' && zoneEditing.pendingCalibration && (
        <CalibrationPopover
          anchorPosition={{
            top: zoneEditing.pendingCalibration.clientY,
            left: zoneEditing.pendingCalibration.clientX
          }}
          lengthPx={distance(
            { x: zoneEditing.pendingCalibration.x1, y: zoneEditing.pendingCalibration.y1 },
            { x: zoneEditing.pendingCalibration.x2, y: zoneEditing.pendingCalibration.y2 }
          )}
          onSave={zoneEditing.saveCalibration}
          onCancel={zoneEditing.cancelPendingCalibration}
        />
      )}

      {children}
    </Box>
  )
}
