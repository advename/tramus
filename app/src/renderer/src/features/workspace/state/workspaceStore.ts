import { create } from 'zustand'

import type { Correction, Setup } from '../../../api/types'

/**
 * UI state of the open video workspace (one video at a time). Server data — the session, track,
 * flags, results, history — lives in TanStack Query (`../data`), never here.
 *
 * Frames are the unit of position: `currentFrame` and `range` are frame indices. Convert to
 * video time only for display, via the frame-times array (`../lib/frames`).
 */

export type WorkspaceStep = 'setup' | 'tracking' | 'review' | 'results'
export const WORKSPACE_STEPS: readonly WorkspaceStep[] = ['setup', 'tracking', 'review', 'results']

export type SetupTool = 'select' | 'arena' | 'rect' | 'ellipse' | 'polygon' | 'measure' | 'pan'
export type ReviewTool = 'select' | 'position' | 'hidden' | 'fill' | 'pan'
export type StageView = 'video' | 'tracker'
export type InspectorTab = 'flags' | 'zones' | 'history'
export type ResultsView = 'summary' | 'events'
export type FlagFilter = 'all' | 'unresolved' | 'fixed' | 'accepted'

/** What is selected on the stage: the arena outline, one zone, or nothing. */
export type StageSelection = { type: 'arena' } | { type: 'zone'; zoneId: string } | null

/** Inclusive frame range, e.g. a Shift+drag selection on the timeline in Review. */
export interface FrameRange {
  start: number
  end: number
}

export interface Overlays {
  trail: boolean
  heatmap: boolean
  outline: boolean
  currentZone: boolean
}

/** One undoable edit of the session document. `before`/`after` are complete values. */
export type EditRecord =
  | { kind: 'setup'; label: string; before: Setup; after: Setup }
  | { kind: 'corrections'; label: string; before: Correction[]; after: Correction[] }

export const STAGE_ZOOM_MIN = 1
export const STAGE_ZOOM_MAX = 8
export const TIMELINE_ZOOM_MIN = 1
export const TIMELINE_ZOOM_MAX = 16

interface WorkspaceState {
  videoId: string | null
  frameCount: number

  // Playback
  currentFrame: number
  playing: boolean
  speed: number

  // Stage
  setupTool: SetupTool
  reviewTool: ReviewTool
  selection: StageSelection
  stageView: StageView
  /** 1 = fit to the available area. Pan is in screen pixels relative to the fitted position. */
  stageZoom: number
  stagePan: { x: number; y: number }
  overlays: Overlays
  trailLengthS: number

  // Timeline
  timelineZoom: number
  range: FrameRange | null

  // Inspector & results
  inspectorTab: InspectorTab
  resultsView: ResultsView
  flagFilter: FlagFilter
  selectedFlagId: string | null

  // Undo / redo of document edits (applied by `useUndoRedo` in ../data)
  undoStack: EditRecord[]
  redoStack: EditRecord[]
}

interface WorkspaceActions {
  /** Called when a workspace opens a video. Resets everything video-specific. */
  open: (videoId: string, defaults: { speed: number; trailLengthS: number }) => void
  setFrameCount: (frameCount: number) => void

  seek: (frame: number) => void
  stepFrames: (delta: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setSpeed: (speed: number) => void

  setSetupTool: (tool: SetupTool) => void
  setReviewTool: (tool: ReviewTool) => void
  select: (selection: StageSelection) => void
  setStageView: (view: StageView) => void
  toggleStageView: () => void
  setStageZoom: (zoom: number) => void
  setStagePan: (pan: { x: number; y: number }) => void
  resetStageView: () => void
  toggleOverlay: (overlay: keyof Overlays) => void
  setTrailLength: (seconds: number) => void

  setTimelineZoom: (zoom: number) => void
  setRange: (range: FrameRange | null) => void

  setInspectorTab: (tab: InspectorTab) => void
  setResultsView: (view: ResultsView) => void
  setFlagFilter: (filter: FlagFilter) => void
  selectFlag: (flagId: string | null) => void

  pushEdit: (edit: EditRecord) => void
  takeUndo: () => EditRecord | undefined
  takeRedo: () => EditRecord | undefined
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const initialState: WorkspaceState = {
  videoId: null,
  frameCount: 0,
  currentFrame: 0,
  playing: false,
  speed: 1,
  setupTool: 'select',
  reviewTool: 'select',
  selection: null,
  stageView: 'video',
  stageZoom: 1,
  stagePan: { x: 0, y: 0 },
  overlays: { trail: true, heatmap: true, outline: true, currentZone: true },
  trailLengthS: 10,
  timelineZoom: 1,
  range: null,
  inspectorTab: 'flags',
  resultsView: 'summary',
  flagFilter: 'all',
  selectedFlagId: null,
  undoStack: [],
  redoStack: []
}

const MAX_UNDO = 200

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()((set, get) => ({
  ...initialState,

  open: (videoId, defaults) =>
    set({
      ...initialState,
      videoId,
      speed: defaults.speed,
      trailLengthS: defaults.trailLengthS
    }),
  setFrameCount: (frameCount) =>
    set((s) => ({
      frameCount,
      currentFrame: clamp(s.currentFrame, 0, Math.max(0, frameCount - 1))
    })),

  seek: (frame) =>
    set((s) => ({ currentFrame: clamp(Math.round(frame), 0, Math.max(0, s.frameCount - 1)) })),
  stepFrames: (delta) => {
    const { currentFrame, frameCount } = get()
    set({
      playing: false,
      currentFrame: clamp(currentFrame + delta, 0, Math.max(0, frameCount - 1))
    })
  },
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),

  setSetupTool: (setupTool) => set({ setupTool }),
  setReviewTool: (reviewTool) => set({ reviewTool }),
  select: (selection) => set({ selection }),
  setStageView: (stageView) => set({ stageView }),
  toggleStageView: () => set((s) => ({ stageView: s.stageView === 'video' ? 'tracker' : 'video' })),
  setStageZoom: (zoom) => set({ stageZoom: clamp(zoom, STAGE_ZOOM_MIN, STAGE_ZOOM_MAX) }),
  setStagePan: (stagePan) => set({ stagePan }),
  resetStageView: () => set({ stageZoom: 1, stagePan: { x: 0, y: 0 } }),
  toggleOverlay: (overlay) =>
    set((s) => ({ overlays: { ...s.overlays, [overlay]: !s.overlays[overlay] } })),
  setTrailLength: (trailLengthS) => set({ trailLengthS: clamp(trailLengthS, 5, 30) }),

  setTimelineZoom: (zoom) =>
    set({ timelineZoom: clamp(zoom, TIMELINE_ZOOM_MIN, TIMELINE_ZOOM_MAX) }),
  setRange: (range) =>
    set({
      range: range && {
        start: Math.min(range.start, range.end),
        end: Math.max(range.start, range.end)
      }
    }),

  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setResultsView: (resultsView) => set({ resultsView }),
  setFlagFilter: (flagFilter) => set({ flagFilter }),
  selectFlag: (selectedFlagId) => set({ selectedFlagId }),

  pushEdit: (edit) =>
    set((s) => ({ undoStack: [...s.undoStack, edit].slice(-MAX_UNDO), redoStack: [] })),
  takeUndo: () => {
    const { undoStack, redoStack } = get()
    const edit = undoStack.at(-1)
    if (edit) set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, edit] })
    return edit
  },
  takeRedo: () => {
    const { undoStack, redoStack } = get()
    const edit = redoStack.at(-1)
    if (edit) set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, edit] })
    return edit
  }
}))
