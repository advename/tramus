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
