import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import type { Overlays } from '../state/workspaceStore'

const TRAIL_LENGTHS = [5, 10, 20, 30]

const ITEMS: readonly { key: keyof Overlays; label: string; title: string }[] = [
  { key: 'trail', label: 'Trail', title: 'Movement trail · T' },
  { key: 'heatmap', label: 'Heatmap', title: 'Heatmap of the trail window · M' },
  { key: 'outline', label: 'Body outline', title: 'Body outline · L' },
  { key: 'currentZone', label: 'Current zone', title: 'Highlight the zone the mouse is in · Z' }
]

export interface OverlayTogglesProps {
  overlays: Overlays
  onToggle: (overlay: keyof Overlays) => void
  trailLengthS: number
  onTrailLengthChange: (seconds: number) => void
}

/** Review-only: overlay visibility toggles + the trail-length select (top-right of the stage). */
export function OverlayToggles({
  overlays,
  onToggle,
  trailLengthS,
  onTrailLengthChange
}: OverlayTogglesProps): React.JSX.Element {
  const theme = useTheme()
  const swatchColor: Record<keyof Overlays, string> = {
    trail: theme.palette.trail,
    heatmap: theme.palette.trail,
    outline: theme.palette.common.white,
    currentZone: theme.palette.zones[2] ?? theme.palette.primary.main
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 10,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 0.25,
        p: 0.5,
        maxWidth: 'calc(100% - 80px)',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2.25
      }}
    >
      {ITEMS.map((item) => {
        const on = overlays[item.key]
        return (
          <Button
            key={item.key}
            title={item.title}
            aria-pressed={on}
            onClick={() => onToggle(item.key)}
            sx={{
              height: 28,
              px: 0.75,
              gap: 0.5,
              whiteSpace: 'nowrap',
              bgcolor: on ? 'surface.raised' : 'transparent',
              color: on ? 'text.primary' : 'text.disabled',
              fontWeight: 500
            }}
          >
            <Checkbox
              checked={on}
              size="small"
              disableRipple
              tabIndex={-1}
              inputProps={{ 'aria-hidden': true, tabIndex: -1 }}
              sx={{
                p: 0,
                pointerEvents: 'none',
                color: 'text.disabled',
                '&.Mui-checked': { color: 'primary.main' }
              }}
            />
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: 0.5,
                bgcolor: swatchColor[item.key],
                opacity: on ? 1 : 0.25
              }}
            />
            {item.label}
          </Button>
        )
      })}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: '5px' }} />
      <Box
        component="label"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.75, whiteSpace: 'nowrap' }}
      >
        <Typography variant="caption" color="text.secondary">
          Trail
        </Typography>
        <Select
          value={trailLengthS}
          onChange={(e) => onTrailLengthChange(Number(e.target.value))}
          variant="outlined"
          sx={{ height: 24, fontFamily: '"IBM Plex Mono", monospace', fontSize: 11.5 }}
        >
          {TRAIL_LENGTHS.map((s) => (
            <MenuItem key={s} value={s}>
              {s} s
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  )
}
