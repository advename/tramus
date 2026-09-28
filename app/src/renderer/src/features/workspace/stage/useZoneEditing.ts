import { type RefObject, useEffect, useState } from 'react'

import type { Calibration, Setup, Shape, Zone } from '../../../api/types'
import type { SetupEditor } from '../data'
import {
  distance,
  ellipseFromDrag,
  moveShape,
  movePolygonPoint,
  type Point,
  polygonFromPoints,
  rectFromDrag,
  resizeByHandle,
  shapeMeetsMinimumSize
} from '../lib/geometry'
import { svgPointFromClient } from '../lib/stageTransform'
import { nextZoneColorIndex, nextZoneName, newZoneId } from '../lib/zones'
import {
  type ReviewTool,
  type SetupTool,
  type StageSelection,
  useWorkspaceStore,
  type WorkspaceStep
} from '../state/workspaceStore'

/** A shape being drawn but not yet committed. */
export type ZoneDraft =
  | { kind: 'rect' | 'ellipse'; target: 'arena' | 'zone'; start: Point; current: Point }
  | { kind: 'polygon'; target: 'arena' | 'zone'; points: Point[]; cursor: Point | null }

/** A Measure line being drawn (drag, or click–click), not yet committed. */
export interface MeasureDraft {
  start: Point
  current: Point
}

/** A just-drawn Measure line waiting for its real-world length in the `CalibrationPopover`. */
export interface PendingCalibration {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Screen coordinates of the finishing click, to anchor the popover. */
  clientX: number
  clientY: number
}

/** Which endpoint of the calibration line a drag handle moves. */
export type CalibrationEndpoint = 'start' | 'end'

/** A click within this many video px of the start point counts as a click, not a drag. */
const CLICK_THRESHOLD_PX = 4

function toVideoPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Point {
  return svgPointFromClient(svg, e.clientX, e.clientY)
}

function replaceZoneShape(base: Setup, zoneId: string, shape: Shape): Setup {
  return { ...base, zones: (base.zones ?? []).map((z) => (z.id === zoneId ? { ...z, shape } : z)) }
}

/**
 * A shape target editable on the stage: the arena outline or one zone. Generalises move/resize/
 * vertex editing so the arena isn't a second copy of the zone-editing gestures.
 */
export type ShapeTarget = { kind: 'arena'; shape: Shape } | { kind: 'zone'; zone: Zone }

function targetShape(target: ShapeTarget): Shape {
  return target.kind === 'arena' ? target.shape : target.zone.shape
}

function targetLocked(target: ShapeTarget): boolean {
  return target.kind === 'zone' && target.zone.locked
}

function targetLabel(target: ShapeTarget, verb: string): string {
  return target.kind === 'arena' ? `${verb} arena` : `${verb} zone “${target.zone.name}”`
}

function targetSelection(target: ShapeTarget): StageSelection {
  return target.kind === 'arena' ? { type: 'arena' } : { type: 'zone', zoneId: target.zone.id }
}

function replaceTargetShape(base: Setup, target: ShapeTarget, shape: Shape): Setup {
  return target.kind === 'arena' ? { ...base, arena: shape } : replaceZoneShape(base, target.zone.id, shape)
}

export interface ZoneEditingApi {
  /** Whichever tool is live for the current step (`select`, `arena`, `rect`, … or a review tool). */
  activeTool: SetupTool | ReviewTool
  /** Zones/arena can be selected, moved, resized or deleted (drawing new ones needs `step === 'setup'`). */
  editable: boolean
  draft: ZoneDraft | null
  /** The Measure line currently being drawn (drag in progress, or the first click of click–click). */
  measureDraft: MeasureDraft | null
  /** A just-finished Measure line waiting for its length — drives the `CalibrationPopover`. */
  pendingCalibration: PendingCalibration | null
  /** Selects `target`, and — unless it's locked — drags its outline to move it. */
  onShapePointerDown: (e: React.PointerEvent, target: ShapeTarget) => void
  onHandlePointerDown: (e: React.PointerEvent, target: ShapeTarget, handleIndex: number) => void
  onVertexPointerDown: (e: React.PointerEvent, target: ShapeTarget, vertexIndex: number) => void
  onCalibrationHandlePointerDown: (e: React.PointerEvent, endpoint: CalibrationEndpoint) => void
  onBackgroundPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void
  onBackgroundPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void
  onBackgroundDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => void
  /** Deletes whichever of the arena/a zone is currently selected. */
  deleteSelected: () => void
  cancelDrawing: () => boolean
  /** Saves `pendingCalibration` with this real-world length (mm) as one undoable step. */
  saveCalibration: (lengthMm: number) => void
  /** Discards `pendingCalibration` without saving. */
  cancelPendingCalibration: () => void
}

/**
 * Owns every stage pointer gesture that edits the setup document: selecting/moving/resizing
 * zones, dragging polygon vertices, drawing a new arena or zone, and deleting the selection.
 * `preview()` runs on every pointer move; `commit()` runs once on pointer-up (see
 * `data/editors.ts`'s `useSetupEditor`) so a whole drag is one request and one undo step.
 */
export function useZoneEditing(
  svgRef: RefObject<SVGSVGElement | null>,
  step: WorkspaceStep,
  setupEditor: SetupEditor
): ZoneEditingApi {
  const setupTool = useWorkspaceStore((s) => s.setupTool)
  const reviewTool = useWorkspaceStore((s) => s.reviewTool)
  const selection = useWorkspaceStore((s) => s.selection)
  const select = useWorkspaceStore((s) => s.select)
  const setInspectorTab = useWorkspaceStore((s) => s.setInspectorTab)
  const setSetupTool = useWorkspaceStore((s) => s.setSetupTool)
  const [draft, setDraft] = useState<ZoneDraft | null>(null)
  const [measureDraft, setMeasureDraft] = useState<MeasureDraft | null>(null)
  const [pendingCalibration, setPendingCalibration] = useState<PendingCalibration | null>(null)

  const activeTool: SetupTool | ReviewTool =
    step === 'setup' ? setupTool : step === 'review' ? reviewTool : 'select'
  const editable = step === 'setup' || step === 'review'

  // Esc / Enter while a polygon draft is in progress.
  useEffect(() => {
    if (!draft || draft.kind !== 'polygon') return undefined
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        finishPolygon()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setDraft(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `finishPolygon` closes over `draft`/`setup`.
  }, [draft])

  function commitNewZone(shape: Shape): void {
    const base = setupEditor.setup
    if (!base) return
    const zones = base.zones ?? []
    const zone: Zone = {
      id: newZoneId(),
      name: nextZoneName(zones),
      color_index: nextZoneColorIndex(zones),
      shape,
      visible: true,
      locked: false
    }
    select({ type: 'zone', zoneId: zone.id })
    void setupEditor.commit({ ...base, zones: [...zones, zone] }, `Add zone “${zone.name}”`, base)
  }

  function commitArena(shape: Shape): void {
    const base = setupEditor.setup
    if (!base) return
    select({ type: 'arena' })
    setSetupTool('select') // drawing is done — switch straight to Select so the arena is adjustable
    void setupEditor.commit({ ...base, arena: shape }, 'Draw arena', base)
  }

  /** A Measure line was just finished (drag release or second click) — opens the length popover
   * unless it's too short to be a deliberate line (a stray click). */
  function finishMeasure(start: Point, end: Point, clientX: number, clientY: number): void {
    setMeasureDraft(null)
    if (distance(start, end) < CLICK_THRESHOLD_PX) return
    setPendingCalibration({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, clientX, clientY })
  }

  function finishPolygon(): void {
    setDraft((d) => {
      if (!d || d.kind !== 'polygon') return d
      let points = d.points
      // Drop the duplicate final vertex the second click of a double-click leaves behind.
      if (points.length >= 2) {
        const a = points[points.length - 1]!
        const b = points[points.length - 2]!
        if (distance(a, b) < CLICK_THRESHOLD_PX) points = points.slice(0, -1)
      }
      if (points.length >= 3) {
        const shape = polygonFromPoints(points)
        if (d.target === 'arena') commitArena(shape)
        else commitNewZone(shape)
      }
      return null
    })
  }

  const onShapePointerDown = (e: React.PointerEvent, target: ShapeTarget): void => {
    if (!editable || activeTool !== 'select') return
    e.stopPropagation()
    select(targetSelection(target))
    if (step === 'review') setInspectorTab('zones')
    if (targetLocked(target)) return
    const svg = svgRef.current
    const base = setupEditor.setup
    if (!svg || !base) return
    const startPoint = toVideoPoint(svg, e)
    const startShape = targetShape(target)

    const onMove = (ev: PointerEvent): void => {
      const cur = toVideoPoint(svg, ev)
      const moved = moveShape(startShape, cur.x - startPoint.x, cur.y - startPoint.y)
      setupEditor.preview(replaceTargetShape(base, target, moved))
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const cur = toVideoPoint(svg, ev)
      if (distance(startPoint, cur) < CLICK_THRESHOLD_PX) {
        setupEditor.preview(base) // pure click — revert the optimistic preview, nothing moved
        return
      }
      const moved = moveShape(startShape, cur.x - startPoint.x, cur.y - startPoint.y)
      void setupEditor.commit(
        replaceTargetShape(base, target, moved),
        targetLabel(target, 'Move'),
        base
      )
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onHandlePointerDown = (
    e: React.PointerEvent,
    target: ShapeTarget,
    handleIndex: number
  ): void => {
    const shape = targetShape(target)
    if (!editable || activeTool !== 'select' || targetLocked(target) || shape.kind === 'polygon')
      return
    e.stopPropagation()
    const svg = svgRef.current
    const base = setupEditor.setup
    if (!svg || !base) return

    const onMove = (ev: PointerEvent): void => {
      const p = toVideoPoint(svg, ev)
      setupEditor.preview(replaceTargetShape(base, target, resizeByHandle(shape, handleIndex, p)))
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const p = toVideoPoint(svg, ev)
      const resized = resizeByHandle(shape, handleIndex, p)
      if (!shapeMeetsMinimumSize(resized)) {
        setupEditor.preview(base)
        return
      }
      void setupEditor.commit(
        replaceTargetShape(base, target, resized),
        targetLabel(target, 'Resize'),
        base
      )
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onVertexPointerDown = (
    e: React.PointerEvent,
    target: ShapeTarget,
    vertexIndex: number
  ): void => {
    const shape = targetShape(target)
    if (!editable || activeTool !== 'select' || targetLocked(target) || shape.kind !== 'polygon')
      return
    e.stopPropagation()
    const svg = svgRef.current
    const base = setupEditor.setup
    if (!svg || !base) return

    const onMove = (ev: PointerEvent): void => {
      const p = toVideoPoint(svg, ev)
      setupEditor.preview(replaceTargetShape(base, target, movePolygonPoint(shape, vertexIndex, p)))
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const p = toVideoPoint(svg, ev)
      void setupEditor.commit(
        replaceTargetShape(base, target, movePolygonPoint(shape, vertexIndex, p)),
        targetLabel(target, 'Edit'),
        base
      )
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onCalibrationHandlePointerDown = (
    e: React.PointerEvent,
    endpoint: CalibrationEndpoint
  ): void => {
    if (!editable || activeTool !== 'select') return
    e.stopPropagation()
    const svg = svgRef.current
    const base = setupEditor.setup
    const calibration = base?.calibration
    if (!svg || !base || !calibration) return

    const moved = (p: Point): Calibration =>
      endpoint === 'start'
        ? { ...calibration, x1: p.x, y1: p.y }
        : { ...calibration, x2: p.x, y2: p.y }

    const onMove = (ev: PointerEvent): void => {
      setupEditor.preview({ ...base, calibration: moved(toVideoPoint(svg, ev)) })
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const next = moved(toVideoPoint(svg, ev))
      if (distance({ x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 }) < CLICK_THRESHOLD_PX) {
        setupEditor.preview(base) // would collapse the line to a point — revert
        return
      }
      void setupEditor.commit({ ...base, calibration: next }, 'Adjust scale line', base)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (!editable) return
    const svg = svgRef.current
    if (!svg) return
    const p = toVideoPoint(svg, e)

    if (activeTool === 'select') {
      select(null)
      return
    }

    if (activeTool === 'rect' || activeTool === 'ellipse') {
      e.preventDefault()
      const start = p
      setDraft({ kind: activeTool, target: 'zone', start, current: start })
      const onMove = (ev: PointerEvent): void => {
        const cur = toVideoPoint(svg, ev)
        setDraft((d) => (d && d.kind !== 'polygon' ? { ...d, current: cur } : d))
      }
      const onUp = (ev: PointerEvent): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        const cur = toVideoPoint(svg, ev)
        setDraft(null)
        const shape = activeTool === 'rect' ? rectFromDrag(start, cur) : ellipseFromDrag(start, cur)
        if (shapeMeetsMinimumSize(shape)) commitNewZone(shape)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }

    if (activeTool === 'polygon') {
      setDraft((d) =>
        d && d.kind === 'polygon' && d.target === 'zone'
          ? { ...d, points: [...d.points, p] }
          : { kind: 'polygon', target: 'zone', points: [p], cursor: p }
      )
      return
    }

    if (activeTool === 'measure') {
      if (pendingCalibration) return // popover open — ignore background clicks until it's resolved
      if (measureDraft) {
        // Second click of click–click: finish the line at this point.
        finishMeasure(measureDraft.start, p, e.clientX, e.clientY)
        return
      }
      e.preventDefault()
      const start = p
      setMeasureDraft({ start, current: start })
      let moved = false
      const onMove = (ev: PointerEvent): void => {
        const cur = toVideoPoint(svg, ev)
        if (!moved && distance(start, cur) > CLICK_THRESHOLD_PX) moved = true
        setMeasureDraft({ start, current: cur })
      }
      const onUp = (ev: PointerEvent): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        if (moved) finishMeasure(start, toVideoPoint(svg, ev), ev.clientX, ev.clientY)
        // else: leave `measureDraft` at `{ start, current: start }` — the click–click second
        // point is picked up above, and `onBackgroundPointerMove` keeps it tracking the cursor.
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }

    if (activeTool === 'arena') {
      const alreadyDrawingPolygon = draft?.kind === 'polygon' && draft.target === 'arena'
      if (alreadyDrawingPolygon) {
        setDraft((d) => (d && d.kind === 'polygon' ? { ...d, points: [...d.points, p] } : d))
        return
      }
      e.preventDefault()
      const start = p
      let moved = false
      const onMove = (ev: PointerEvent): void => {
        const cur = toVideoPoint(svg, ev)
        if (!moved && distance(start, cur) > CLICK_THRESHOLD_PX) moved = true
        if (moved) setDraft({ kind: 'rect', target: 'arena', start, current: cur })
      }
      const onUp = (ev: PointerEvent): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        const cur = toVideoPoint(svg, ev)
        if (moved) {
          setDraft(null)
          const shape = rectFromDrag(start, cur)
          if (shapeMeetsMinimumSize(shape)) commitArena(shape)
        } else {
          setDraft({ kind: 'polygon', target: 'arena', points: [start], cursor: start })
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  const onBackgroundPointerMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const svg = svgRef.current
    if (!svg) return
    if (draft && draft.kind === 'polygon') {
      const cursor = toVideoPoint(svg, e)
      setDraft((d) => (d && d.kind === 'polygon' ? { ...d, cursor } : d))
      return
    }
    if (measureDraft) {
      const cursor = toVideoPoint(svg, e)
      setMeasureDraft((d) => (d ? { ...d, current: cursor } : d))
    }
  }

  const onBackgroundDoubleClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (!draft || draft.kind !== 'polygon') return
    e.preventDefault()
    finishPolygon()
  }

  const deleteSelected = (): void => {
    const base = setupEditor.setup
    if (!base || !editable || !selection) return
    if (selection.type === 'arena') {
      if (!base.arena) return
      select(null)
      void setupEditor.commit({ ...base, arena: null }, 'Delete arena', base)
      return
    }
    const zone = (base.zones ?? []).find((z) => z.id === selection.zoneId)
    if (!zone || zone.locked) return
    select(null)
    void setupEditor.commit(
      { ...base, zones: (base.zones ?? []).filter((z) => z.id !== zone.id) },
      `Delete zone “${zone.name}”`,
      base
    )
  }

  const cancelDrawing = (): boolean => {
    if (pendingCalibration) {
      setPendingCalibration(null)
      return true
    }
    if (measureDraft) {
      setMeasureDraft(null)
      return true
    }
    if (!draft) return false
    setDraft(null)
    return true
  }

  const saveCalibration = (lengthMm: number): void => {
    const base = setupEditor.setup
    if (!base || !pendingCalibration) return
    const calibration: Calibration = {
      x1: pendingCalibration.x1,
      y1: pendingCalibration.y1,
      x2: pendingCalibration.x2,
      y2: pendingCalibration.y2,
      length_mm: lengthMm
    }
    setPendingCalibration(null)
    setSetupTool('select')
    void setupEditor.commit({ ...base, calibration }, 'Set scale')
  }

  const cancelPendingCalibration = (): void => {
    setPendingCalibration(null)
  }

  return {
    activeTool,
    editable,
    draft,
    measureDraft,
    pendingCalibration,
    onShapePointerDown,
    onHandlePointerDown,
    onVertexPointerDown,
    onCalibrationHandlePointerDown,
    onBackgroundPointerDown,
    onBackgroundPointerMove,
    onBackgroundDoubleClick,
    deleteSelected,
    cancelDrawing,
    saveCalibration,
    cancelPendingCalibration
  }
}
