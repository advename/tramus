import { useTheme } from '@mui/material/styles'

import type { Template } from '../../api/types'
import { shapeElement } from './shapeSvg'

export interface TemplatePreviewProps {
  template: Pick<Template, 'arena' | 'zones' | 'reference_width' | 'reference_height'>
}

/**
 * A small SVG preview of a template's arena and zones, drawn on the template's own reference
 * frame size (`designs/Screens.dc.html`'s batch "Choose" template list uses the same idea).
 */
export function TemplatePreview({ template }: TemplatePreviewProps): React.JSX.Element {
  const theme = useTheme()
  const { arena, zones, reference_width: width, reference_height: height } = template

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Arena and zones preview"
    >
      {arena
        ? shapeElement(arena, {
            fill: 'none',
            stroke: theme.palette.text.disabled,
            strokeWidth: Math.max(width, height) * 0.006,
            strokeDasharray: `${Math.max(width, height) * 0.018} ${Math.max(width, height) * 0.012}`
          })
        : null}
      {(zones ?? []).map((zone) => {
        const color = theme.palette.zones[zone.color_index % theme.palette.zones.length]
        return (
          <g key={zone.id}>
            {shapeElement(zone.shape, {
              fill: color,
              fillOpacity: 0.2,
              stroke: color,
              strokeWidth: Math.max(width, height) * 0.018
            })}
          </g>
        )
      })}
    </svg>
  )
}
