import type { Shape } from '../../../api/types'

/**
 * Shape helpers for the Setup inspector. Shape coordinates are already in video pixels
 * (`docs/architecture.md` §3), so nothing here needs a display→video scale factor.
 */

export function shapeKindLabel(kind: Shape['kind']): string {
  switch (kind) {
    case 'rect':
      return 'Rectangle'
    case 'ellipse':
      return 'Ellipse'
    case 'polygon':
      return 'Polygon'
  }
}

/** e.g. `"Rectangle · 918 × 1338 px"`, `"Polygon · 5 corners"`. */
export function describeShape(shape: Shape): string {
  const kind = shapeKindLabel(shape.kind)
  switch (shape.kind) {
    case 'rect':
      return `${kind} · ${Math.round(shape.width)} × ${Math.round(shape.height)} px`
    case 'ellipse':
      return `${kind} · ${Math.round(shape.rx * 2)} × ${Math.round(shape.ry * 2)} px`
    case 'polygon':
      return `${kind} · ${shape.points.length} corners`
  }
}

export interface GeometryField {
  key: string
  value: number
}

/** Read-only geometry readout for the selected zone's properties panel (video px). */
export function geometryFields(shape: Shape): GeometryField[] {
  switch (shape.kind) {
    case 'rect':
      return [
        { key: 'X', value: Math.round(shape.x) },
        { key: 'Y', value: Math.round(shape.y) },
        { key: 'W', value: Math.round(shape.width) },
        { key: 'H', value: Math.round(shape.height) }
      ]
    case 'ellipse':
      return [
        { key: 'CX', value: Math.round(shape.cx) },
        { key: 'CY', value: Math.round(shape.cy) },
        { key: 'RX', value: Math.round(shape.rx) },
        { key: 'RY', value: Math.round(shape.ry) }
      ]
    case 'polygon':
      return []
  }
}
