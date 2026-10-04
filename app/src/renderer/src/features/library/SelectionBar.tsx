import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { ShortcutTooltip } from '../../components/ShortcutTooltip'
import { Symbol } from '../../components/Symbol'
import { SHORTCUTS } from '../../lib/shortcutRegistry'

export interface SelectionBarProps {
  count: number
  canExport: boolean
  onApplyTemplate: () => void
  onTrack: () => void
  onExport: () => void
  onClear: () => void
}

/** The bar that appears over the table/grid once 1+ videos are selected. */
export function SelectionBar({
  count,
  canExport,
  onApplyTemplate,
  onTrack,
  onExport,
  onClear
}: SelectionBarProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        bgcolor: 'surface.raised',
        borderBottom: 1,
        borderColor: 'divider',
        flexWrap: 'wrap',
        flex: 'none'
      }}
    >
      <Typography sx={{ fontWeight: 600, mr: 0.75 }}>{count} selected</Typography>
      <Button
        variant="outlined"
        onClick={onApplyTemplate}
        startIcon={<Symbol name="bookmarks" size={16} />}
        sx={{ height: 28, px: 1.5, fontSize: 12.5, fontWeight: 500 }}
      >
        Apply template…
      </Button>
      <ShortcutTooltip title="Track" shortcut={SHORTCUTS.trackSelected.combo}>
        <Button
          variant="contained"
          onClick={onTrack}
          startIcon={<Symbol name="play_circle" size={16} />}
          sx={{ height: 28, px: 1.5, fontSize: 12.5, fontWeight: 600 }}
        >
          Track
        </Button>
      </ShortcutTooltip>
      <Button
        variant="outlined"
        disabled={!canExport}
        onClick={onExport}
        startIcon={<Symbol name="download" size={16} />}
        sx={{ height: 28, px: 1.5, fontSize: 12.5, fontWeight: 500 }}
      >
        Export results
      </Button>
      <Box sx={{ flex: 1 }} />
      <ShortcutTooltip title="Clear selection" shortcut={SHORTCUTS.clearSelection.combo}>
        <Button
          onClick={onClear}
          sx={{ height: 28, px: 1.25, fontSize: 12.5, fontWeight: 400, color: 'text.secondary' }}
        >
          Clear selection
        </Button>
      </ShortcutTooltip>
    </Box>
  )
}
