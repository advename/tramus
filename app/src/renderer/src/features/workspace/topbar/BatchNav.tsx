import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'

import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'

export interface BatchNavProps {
  /** 0-based index of the current video within the batch, or `null` while it's still loading or
   * this video isn't (or is no longer) one of the batch's items. */
  index: number | null
  total: number
  onPrev: () => void
  onNext: () => void
  onBackToBatch: () => void
}

/** The compact "Batch · N of M" navigator shown in the workspace top bar while `?batch=` is in
 * the URL (opened from the Batch Finish step) — `‹ Prev` / `Next ›` step through the batch's
 * videos, `Back to batch` returns to the Batch screen's Finish overview. */
export function BatchNav({
  index,
  total,
  onPrev,
  onNext,
  onBackToBatch
}: BatchNavProps): React.JSX.Element {
  const hasPosition = index !== null && total > 0
  const canPrev = hasPosition && index > 0
  const canNext = hasPosition && index < total - 1

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        p: '3px',
        pl: 1,
        borderRadius: '9px',
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        flexShrink: 0
      }}
    >
      <Symbol name="stacks" size={15} sx={{ color: 'text.disabled' }} />
      <Typography
        variant="mono"
        sx={{ fontSize: 11.5, color: 'text.secondary', px: 0.75, whiteSpace: 'nowrap' }}
      >
        {hasPosition ? `Batch · ${index + 1} of ${total}` : 'Batch'}
      </Typography>
      <ShortcutTooltip title="Previous video in batch" shortcut="mod+[">
        <span>
          <IconButton onClick={onPrev} disabled={!canPrev} sx={{ width: 24, height: 24 }}>
            <Symbol name="chevron_left" size={16} />
          </IconButton>
        </span>
      </ShortcutTooltip>
      <ShortcutTooltip title="Next video in batch" shortcut="mod+]">
        <span>
          <IconButton onClick={onNext} disabled={!canNext} sx={{ width: 24, height: 24 }}>
            <Symbol name="chevron_right" size={16} />
          </IconButton>
        </span>
      </ShortcutTooltip>
      <Button
        onClick={onBackToBatch}
        sx={{ height: 24, px: 1, fontSize: 11.5, fontWeight: 500, color: 'text.secondary' }}
      >
        Back to batch
      </Button>
    </Box>
  )
}
