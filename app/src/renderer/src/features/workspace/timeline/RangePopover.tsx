import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'

import { Symbol } from '../../../components/Symbol'

export interface RangePopoverProps {
  left: string
  rangeText: string
  editable: boolean
  onFill: () => void
  onHide: () => void
  onClear: () => void
}

/**
 * The small toolbar shown under a Shift-dragged Review range: "Fill in between (F)" and
 * "Mouse not visible (N)" — see `docs/architecture.md` §5.3 (`interpolate` / `mark_hidden`).
 */
export function RangePopover({
  left,
  rangeText,
  editable,
  onFill,
  onHide,
  onClear
}: RangePopoverProps): React.JSX.Element {
  return (
    <Box
      data-no-drag
      sx={{
        position: 'absolute',
        left,
        top: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        py: 0.25,
        pr: 0.25,
        pl: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: 1.5,
        boxShadow: 6,
        whiteSpace: 'nowrap',
        zIndex: 3
      }}
    >
      <Typography variant="mono" sx={{ fontSize: 11, color: 'text.secondary', mr: 0.5 }}>
        {rangeText}
      </Typography>
      <Button
        title="Fill in between · F"
        onClick={onFill}
        disabled={!editable}
        variant="contained"
        sx={{ height: 22, px: 0.875, fontSize: 11.5, fontWeight: 600 }}
      >
        Fill in between
      </Button>
      <Button
        title="Mouse not visible · N"
        onClick={onHide}
        disabled={!editable}
        sx={{ height: 22, px: 0.875, fontSize: 11.5 }}
      >
        Mouse not visible
      </Button>
      <IconButton
        title="Clear selection · Esc"
        onClick={onClear}
        sx={{ width: 22, height: 22, color: 'text.secondary' }}
      >
        <Symbol name="close" size={15} />
      </IconButton>
    </Box>
  )
}
