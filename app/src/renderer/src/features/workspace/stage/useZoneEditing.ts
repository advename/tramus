import { type RefObject, useEffect, useState } from 'react'

import type { Setup, Shape, Zone } from '../../../api/types'
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
import { type ReviewTool, type SetupTool, useWorkspaceStore, type WorkspaceStep } from '../state/workspaceStore'

/** A shape being drawn but not yet committed. */
export type ZoneDraft =
  | { kind: 'rect' | 'ellipse'; target: 'arena' | 'zone'; start: Point; current: Point }
  | { kind: 'polygon'; target: 'arena' | 'zone'; points: Point[]; cursor: Point | null }

/** A click within this many video px of the start point counts as a click, not a drag. */
const CLICK_THRESHOLD_PX = 4

function toVideoPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Point {
  return svgPointFromClient(svg, e.clientX, e.clientY)
}

function replaceZoneShape(base: Setup, zoneId: string, shape: Shape): Setup {
  return { ...base, zones: (base.zones ?? []).map((z) => (z.id === zoneId ? { ...z, shape } : z)) }
}

export interface ZoneEditingApi {
  /** Whichever tool is live for the current step (`select`, `arena`, `rect`, … or a review tool). */
  activeTool: SetupTool | ReviewTool
  /** Zones/arena can be selected, moved, resized or deleted (drawing new ones needs `step === 'setup'`). */
  editable: boolean
  draft: ZoneDraft | null
  onZonePointerDown: (e: React.PointerEvent, zone: Zone) => void
  onHandlePointerDown: (e: React.PointerEvent, zone: Zone, handleIndex: number) => void
  onVertexPointerDown: (e: React.PointerEvent, zone: Zone, vertexIndex: number) => void
  onBackgroundPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void
  onBackgroundPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void
  onBackgroundDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => void
  deleteSelectedZone: () => void
  cancelDrawing: () => boolean
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
  const [draft, setDraft] = useState<ZoneDraft | null>(null)

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
    void setupEditor.commit({ ...base, arena: shape }, 'Draw arena', base)
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

  const onZonePointerDown = (e: React.PointerEvent, zone: Zone): void => {
    if (!editable || activeTool !== 'select') return
    e.stopPropagation()
    select({ type: 'zone', zoneId: zone.id })
    if (step === 'review') setInspectorTab('zones')
    if (zone.locked) return
    const svg = svgRef.current
    const base = setupEditor.setup
    if (!svg || !base) return
    const startPoint = toVideoPoint(svg, e)
    const startShape = zone.shape

    const onMove = (ev: PointerEvent): void => {
      const cur = toVideoPoint(svg, ev)
      const moved = moveShape(startShape, cur.x - startPoint.x, cur.y - startPoint.y)
      setupEditor.preview(replaceZoneShape(base, zone.id, moved))
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
      void setupEditor.commit(replaceZoneShape(base, zone.id, moved), `Move zone “${zone.name}”`, base)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onHandlePointerDown = (e: React.PointerEvent, zone: Zone, handleIndex: number): void => {
    const shape = zone.shape
    if (!editable || activeTool !== 'select' || zone.locked || shape.kind === 'polygon') return
    e.stopPropagation()
    const svg = svgRef.current
    const base = setupEditor.setup
    if (!svg || !base) return

    const onMove = (ev: PointerEvent): void => {
      const p = toVideoPoint(svg, ev)
      setupEditor.preview(replaceZoneShape(base, zone.id, resizeByHandle(shape, handleIndex, p)))
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
        replaceZoneShape(base, zone.id, resized),
        `Resize zone “${zone.name}”`,
        base
      )
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onVertexPointerDown = (e: React.PointerEvent, zone: Zone, vertexIndex: number): void => {
    const shape = zone.shape
    if (!editable || activeTool !== 'select' || zone.locked || shape.kind !== 'polygon') return
    e.stopPropagation()
    const svg = svgRef.current
    const base = setupEditor.setup
    if (!svg || !base) return

    const onMove = (ev: PointerEvent): void => {
      const p = toVideoPoint(svg, ev)
      setupEditor.preview(replaceZoneShape(base, zone.id, movePolygonPoint(shape, vertexIndex, p)))
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const p = toVideoPoint(svg, ev)
      void setupEditor.commit(
        replaceZoneShape(base, zone.id, movePolygonPoint(shape, vertexIndex, p)),
        `Edit zone “${zone.name}”`,
        base
      )
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
    if (!draft || draft.kind !== 'polygon') return
    const svg = svgRef.current
    if (!svg) return
    const cursor = toVideoPoint(svg, e)
    setDraft((d) => (d && d.kind === 'polygon' ? { ...d, cursor } : d))
  }

  const onBackgroundDoubleClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (!draft || draft.kind !== 'polygon') return
    e.preventDefault()
    finishPolygon()
  }

  const deleteSelectedZone = (): void => {
    const base = setupEditor.setup
    if (!base || !editable || selection?.type !== 'zone') return
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
    if (!draft) return false
    setDraft(null)
    return true
  }

  return {
    activeTool,
    editable,
    draft,
    onZonePointerDown,
    onHandlePointerDown,
    onVertexPointerDown,
    onBackgroundPointerDown,
    onBackgroundPointerMove,
    onBackgroundDoubleClick,
    deleteSelectedZone,
    cancelDrawing
  }
}
