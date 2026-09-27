import type { ReactElement, SVGAttributes } from 'react'

import type { Shape } from '../../api/types'

/** Renders a `Shape` (rect/ellipse/polygon) as the matching SVG geometry element. */
export function shapeElement(shape: Shape, props: SVGAttributes<SVGElement>): ReactElement {
  switch (shape.kind) {
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} {...props} />
    case 'ellipse':
      return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...props} />
    case 'polygon':
      return <polygon points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')} {...props} />
  }
}
