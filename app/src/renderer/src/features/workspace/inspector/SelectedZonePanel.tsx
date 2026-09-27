import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import type { Zone } from '../../../api/types'
import { zoneTokens } from '../../../theme/tokens'
import { geometryFields, shapeKindLabel } from '../lib/shapes'

export interface SelectedZonePanelProps {
  zone: Zone
  onColorChange: (colorIndex: number) => void
}

/** Colour swatches + read-only geometry readout for the selected zone (design: `hasSel` block). */
export function SelectedZonePanel({ zone, onColorChange }: SelectedZonePanelProps): React.JSX.Element {
  const theme = useTheme()
  const geometry = geometryFields(zone.shape)

  return (
    <Box
      sx={{
        mx: 1.75,
        my: 1,
        p: 1.5,
        borderRadius: '8px',
        bgcolor: 'surface.raised',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {shapeKindLabel(zone.shape.kind)} zone
        </Typography>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {zone.name}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>Colour</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {theme.palette.zones.map((color, index) => (
            <ButtonBase
              key={index}
              title={zoneTokens[index]?.name}
              onClick={() => onColorChange(index)}
              sx={{
                width: 22,
                height: 22,
                boxSizing: 'border-box',
                borderRadius: '5px',
                border: '2px solid',
                borderColor: zone.color_index === index ? 'text.primary' : 'transparent',
                bgcolor: color
              }}
            />
          ))}
        </Box>
      </Box>

      {geometry.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
            Position and size (video px)
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 0.75 }}>
            {geometry.map((field) => (
              <Box
                key={field.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  height: 28,
                  px: 0.75,
                  border: 1,
                  borderColor: 'surface.lineStrong',
                  borderRadius: '6px',
                  bgcolor: 'background.paper',
                  minWidth: 0
                }}
              >
                <Typography variant="mono" sx={{ fontSize: 11.5, color: 'text.disabled' }}>
                  {field.key}
                </Typography>
                <Typography variant="mono" sx={{ fontSize: 11.5, overflow: 'hidden' }}>
                  {field.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : zone.shape.kind === 'polygon' ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {zone.shape.points.length} corners. Drag a corner to move it; double-click an edge to add
          one.
        </Typography>
      ) : null}
    </Box>
  )
}
