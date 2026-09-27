import type { EllipseShape, PolygonShape, RectShape, Shape } from '../../../api/types'

/**
 * Shape geometry in video-pixel space (see `docs/architecture.md` §3). Pure functions only — no
 * React, no store — so they're cheap to unit-test and reuse from both the stage's pointer
 * handlers and any future geometry needs (results, thumbnails, …).
 */

export interface Point {
  x: number
  y: number
}

/**
 * `PolygonShape.points` comes through the generated API types as `number[][]`, not the tuple
 * `[number, number][]` the schema declares — `openapi-fetch`'s `Readable<>` helper widens tuples
 * to arrays (see `api/types.ts`). `coord` reads a pair safely under `noUncheckedIndexedAccess`.
 */
function coord(p: readonly number[]): Point {
  return { x: p[0] ?? 0, y: p[1] ?? 0 }
}

export interface BBox {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function bboxWidth(b: BBox): number {
  return b.x2 - b.x1
}

export function bboxHeight(b: BBox): number {
  return b.y2 - b.y1
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Axis-aligned bounding box of any shape, in video px. */
export function shapeBBox(shape: Shape): BBox {
  if (shape.kind === 'rect') {
    return { x1: shape.x, y1: shape.y, x2: shape.x + shape.width, y2: shape.y + shape.height }
  }
  if (shape.kind === 'ellipse') {
    return {
      x1: shape.cx - shape.rx,
      y1: shape.cy - shape.ry,
      x2: shape.cx + shape.rx,
      y2: shape.cy + shape.ry
    }
  }
  const points = shape.points.map(coord)
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }
}

/** An SVG path `d` attribute for the shape (closed). */
export function shapePathD(shape: Shape): string {
  if (shape.kind === 'rect') {
    return `M${shape.x} ${shape.y}h${shape.width}v${shape.height}h${-shape.width}Z`
  }
  if (shape.kind === 'ellipse') {
    const { cx, cy, rx, ry } = shape
    // Two arcs, since a single 360° arc is degenerate in SVG.
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`
  }
  const [first, ...rest] = shape.points.map(coord)
  if (!first) return ''
  return `M${first.x} ${first.y}` + rest.map((p) => `L${p.x} ${p.y}`).join('') + 'Z'
}

function pointInPolygon(p: Point, rawPoints: readonly (readonly number[])[]): boolean {
  const points = rawPoints.map(coord)
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!
    const b = points[j]!
    const intersects =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

/** Hit test in video px — exact for rect/ellipse/polygon (not just the bounding box). */
export function pointInShape(shape: Shape, p: Point): boolean {
  if (shape.kind === 'rect') {
    const b = shapeBBox(shape)
    return p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2
  }
  if (shape.kind === 'ellipse') {
    if (shape.rx <= 0 || shape.ry <= 0) return false
    const dx = (p.x - shape.cx) / shape.rx
    const dy = (p.y - shape.cy) / shape.ry
    return dx * dx + dy * dy <= 1
  }
  return pointInPolygon(p, shape.points)
}

export function moveShape(shape: Shape, dx: number, dy: number): Shape {
  if (shape.kind === 'rect') return { ...shape, x: shape.x + dx, y: shape.y + dy }
  if (shape.kind === 'ellipse') return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy }
  return { ...shape, points: shape.points.map((p) => { const c = coord(p); return [c.x + dx, c.y + dy] }) }
}

export interface HandlePoint extends Point {
  /** CSS cursor for this handle. */
  cursor: string
}

const HANDLE_CURSORS = [
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
  'ew-resize',
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
  'ew-resize'
]

/**
 * The 8 bounding-box handles (corners + edge midpoints), clockwise from top-left — used for
 * rect/ellipse zone selection. Index matches `resizeByHandle`.
 */
export function bboxHandles(b: BBox): HandlePoint[] {
  const midX = (b.x1 + b.x2) / 2
  const midY = (b.y1 + b.y2) / 2
  const points: Point[] = [
    { x: b.x1, y: b.y1 },
    { x: midX, y: b.y1 },
    { x: b.x2, y: b.y1 },
    { x: b.x2, y: midY },
    { x: b.x2, y: b.y2 },
    { x: midX, y: b.y2 },
    { x: b.x1, y: b.y2 },
    { x: b.x1, y: midY }
  ]
  return points.map((p, i) => ({ ...p, cursor: HANDLE_CURSORS[i]! }))
}

const HANDLE_AFFECTS_LEFT = new Set([0, 6, 7])
const HANDLE_AFFECTS_RIGHT = new Set([2, 3, 4])
const HANDLE_AFFECTS_TOP = new Set([0, 1, 2])
const HANDLE_AFFECTS_BOTTOM = new Set([4, 5, 6])

/**
 * Resizes a rect or ellipse by dragging bbox handle `index` (see `bboxHandles`) to `p`, keeping
 * the opposite corner/edge fixed.
 */
export function resizeByHandle(
  shape: RectShape | EllipseShape,
  index: number,
  p: Point
): RectShape | EllipseShape {
  const b = shapeBBox(shape)
  let { x1, y1, x2, y2 } = b
  if (HANDLE_AFFECTS_LEFT.has(index)) x1 = p.x
  if (HANDLE_AFFECTS_RIGHT.has(index)) x2 = p.x
  if (HANDLE_AFFECTS_TOP.has(index)) y1 = p.y
  if (HANDLE_AFFECTS_BOTTOM.has(index)) y2 = p.y
  const nx1 = Math.min(x1, x2)
  const nx2 = Math.max(x1, x2)
  const ny1 = Math.min(y1, y2)
  const ny2 = Math.max(y1, y2)
  if (shape.kind === 'rect') {
    return { ...shape, x: nx1, y: ny1, width: nx2 - nx1, height: ny2 - ny1 }
  }
  return { ...shape, cx: (nx1 + nx2) / 2, cy: (ny1 + ny2) / 2, rx: (nx2 - nx1) / 2, ry: (ny2 - ny1) / 2 }
}

/** Moves one vertex of a polygon zone/arena. */
export function movePolygonPoint(shape: PolygonShape, index: number, p: Point): PolygonShape {
  const points = shape.points.map((pt, i) => (i === index ? [p.x, p.y] : pt))
  return { ...shape, points }
}

/** Inserts a vertex on the edge between `edgeIndex` and `edgeIndex + 1` (double-click a side). */
export function insertPolygonPoint(shape: PolygonShape, edgeIndex: number, p: Point): PolygonShape {
  const points = shape.points.slice()
  points.splice(edgeIndex + 1, 0, [p.x, p.y])
  return { ...shape, points }
}

export function removePolygonPoint(shape: PolygonShape, index: number): PolygonShape {
  return { ...shape, points: shape.points.filter((_, i) => i !== index) }
}

export function rectFromDrag(a: Point, b: Point): RectShape {
  return {
    kind: 'rect',
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

export function ellipseFromDrag(a: Point, b: Point): EllipseShape {
  return {
    kind: 'ellipse',
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
    rx: Math.abs(a.x - b.x) / 2,
    ry: Math.abs(a.y - b.y) / 2
  }
}

export function polygonFromPoints(points: readonly Point[]): PolygonShape {
  return { kind: 'polygon', points: points.map((p) => [p.x, p.y]) }
}

/** True once a drawn shape is big enough to keep (avoids a zero-size zone from a stray click). */
export function shapeMeetsMinimumSize(shape: Shape, minPx = 4): boolean {
  if (shape.kind === 'polygon') return shape.points.length >= 3
  const b = shapeBBox(shape)
  return bboxWidth(b) >= minPx && bboxHeight(b) >= minPx
}
