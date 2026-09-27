import { describe, expect, it } from 'vitest'

import {
  bboxHandles,
  ellipseFromDrag,
  insertPolygonPoint,
  movePolygonPoint,
  moveShape,
  pointInShape,
  rectFromDrag,
  resizeByHandle,
  shapeBBox,
  shapeMeetsMinimumSize
} from './geometry'
import type { EllipseShape, PolygonShape, RectShape } from '../../../api/types'

describe('shapeBBox', () => {
  it('reads a rect directly', () => {
    const rect: RectShape = { kind: 'rect', x: 10, y: 20, width: 30, height: 40 }
    expect(shapeBBox(rect)).toEqual({ x1: 10, y1: 20, x2: 40, y2: 60 })
  })

  it('derives an ellipse bbox from its centre/radii', () => {
    const ellipse: EllipseShape = { kind: 'ellipse', cx: 100, cy: 100, rx: 20, ry: 10 }
    expect(shapeBBox(ellipse)).toEqual({ x1: 80, y1: 90, x2: 120, y2: 110 })
  })

  it('spans a polygon’s points', () => {
    const polygon: PolygonShape = {
      kind: 'polygon',
      points: [
        [0, 0],
        [10, 5],
        [4, 20]
      ]
    }
    expect(shapeBBox(polygon)).toEqual({ x1: 0, y1: 0, x2: 10, y2: 20 })
  })
})

describe('pointInShape', () => {
  it('rejects points outside a rect but keeps the boundary', () => {
    const rect: RectShape = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }
    expect(pointInShape(rect, { x: 5, y: 5 })).toBe(true)
    expect(pointInShape(rect, { x: 10, y: 10 })).toBe(true)
    expect(pointInShape(rect, { x: 11, y: 5 })).toBe(false)
  })

  it('uses the true ellipse boundary, not its bbox', () => {
    const ellipse: EllipseShape = { kind: 'ellipse', cx: 0, cy: 0, rx: 10, ry: 5 }
    // Inside the bbox corner but outside the ellipse itself.
    expect(pointInShape(ellipse, { x: 9, y: 4 })).toBe(false)
    expect(pointInShape(ellipse, { x: 0, y: 0 })).toBe(true)
  })

  it('winds a concave polygon correctly', () => {
    const polygon: PolygonShape = {
      kind: 'polygon',
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 3],
        [0, 10]
      ]
    }
    expect(pointInShape(polygon, { x: 5, y: 1 })).toBe(true)
    expect(pointInShape(polygon, { x: 5, y: 8 })).toBe(false)
  })
})

describe('resizeByHandle', () => {
  it('drags the top-left corner (handle 0) while keeping the opposite corner fixed', () => {
    const rect: RectShape = { kind: 'rect', x: 10, y: 10, width: 20, height: 20 }
    const resized = resizeByHandle(rect, 0, { x: 0, y: 0 }) as RectShape
    expect(resized).toEqual({ kind: 'rect', x: 0, y: 0, width: 30, height: 30 })
  })

  it('drags only the right edge (handle 3) for an ellipse', () => {
    const ellipse: EllipseShape = { kind: 'ellipse', cx: 50, cy: 50, rx: 10, ry: 10 }
    const resized = resizeByHandle(ellipse, 3, { x: 80, y: 999 }) as EllipseShape
    // The right edge moves to x=80; the left edge (x=40) and vertical extent stay put.
    expect(resized.cx).toBe(60)
    expect(resized.rx).toBe(20)
    expect(resized.cy).toBe(50)
    expect(resized.ry).toBe(10)
  })

  it('normalises when dragged past the opposite edge', () => {
    const rect: RectShape = { kind: 'rect', x: 10, y: 10, width: 20, height: 20 }
    const resized = resizeByHandle(rect, 2, { x: -5, y: 40 }) as RectShape
    expect(resized.x).toBeLessThanOrEqual(10)
    expect(resized.width).toBeGreaterThan(0)
    expect(resized.height).toBeGreaterThan(0)
  })
})

describe('bboxHandles', () => {
  it('returns 8 handles at the corners and edge midpoints', () => {
    const handles = bboxHandles({ x1: 0, y1: 0, x2: 10, y2: 20 })
    expect(handles).toHaveLength(8)
    expect(handles[0]).toMatchObject({ x: 0, y: 0 })
    expect(handles[4]).toMatchObject({ x: 10, y: 20 })
  })
})

describe('polygon editing', () => {
  const triangle: PolygonShape = {
    kind: 'polygon',
    points: [
      [0, 0],
      [10, 0],
      [5, 10]
    ]
  }

  it('moves a single vertex', () => {
    const moved = movePolygonPoint(triangle, 1, { x: 20, y: 0 })
    expect(moved.points).toEqual([
      [0, 0],
      [20, 0],
      [5, 10]
    ])
  })

  it('inserts a vertex on an edge', () => {
    const withVertex = insertPolygonPoint(triangle, 0, { x: 5, y: 0 })
    expect(withVertex.points).toEqual([
      [0, 0],
      [5, 0],
      [10, 0],
      [5, 10]
    ])
  })
})

describe('drag construction', () => {
  it('builds a normalised rect regardless of drag direction', () => {
    const rect = rectFromDrag({ x: 50, y: 60 }, { x: 10, y: 20 })
    expect(rect).toEqual({ kind: 'rect', x: 10, y: 20, width: 40, height: 40 })
  })

  it('builds an ellipse centred on the drag bbox', () => {
    const ellipse = ellipseFromDrag({ x: 0, y: 0 }, { x: 20, y: 10 })
    expect(ellipse).toEqual({ kind: 'ellipse', cx: 10, cy: 5, rx: 10, ry: 5 })
  })
})

describe('moveShape', () => {
  it('translates every shape kind', () => {
    const rect: RectShape = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }
    expect(moveShape(rect, 5, 5)).toEqual({ kind: 'rect', x: 5, y: 5, width: 10, height: 10 })
  })
})

describe('shapeMeetsMinimumSize', () => {
  it('rejects a near-zero rect from a stray click', () => {
    const rect: RectShape = { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }
    expect(shapeMeetsMinimumSize(rect)).toBe(false)
  })

  it('requires at least 3 polygon points', () => {
    const polygon: PolygonShape = {
      kind: 'polygon',
      points: [
        [0, 0],
        [10, 10]
      ]
    }
    expect(shapeMeetsMinimumSize(polygon)).toBe(false)
  })
})
