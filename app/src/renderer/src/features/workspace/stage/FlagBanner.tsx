import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { Kbd } from '../../../components/Kbd'
import { Symbol } from '../../../components/Symbol'
import { TimeText } from '../../../components/TimeText'
import type { FlagView } from '../../../api/types'
import { flagReasonLabel, FLAG_STATUS_LABEL, statusChipSx } from '../lib/flags'

export interface FlagBannerProps {
  flag: FlagView
  index: number
  total: number
  timeS: number
  onAccept: () => void
  onSetPosition: () => void
  onReopen: () => void
}

/**
 * The banner shown over the stage when the playhead is inside any flag (Review only) — fixed and
 * accepted flags stay revisitable, not just unresolved ones. Actions depend on status: unresolved
 * offers Accept/Set position, fixed/accepted offer Set position again/Reopen.
 */
export function FlagBanner({
  flag,
  index,
  total,
  timeS,
  onAccept,
  onSetPosition,
  onReopen
}: FlagBannerProps): React.JSX.Element {
  const chipSx = statusChipSx(flag.status)

  return (
    <Box
      sx={{
        position: 'absolute',
        left: '50%',
        bottom: 32,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        py: 0.75,
        pr: 0.75,
        pl: 1.5,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: (theme) =>
          alpha(
            flag.status === 'unresolved' ? theme.palette.warning.main : theme.palette.divider,
            0.55
          ),
        borderRadius: 2.25,
        boxShadow: 8,
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100% - 90px)'
      }}
    >
      <Box
        sx={{
          width: 9,
          height: 9,
          transform: 'rotate(45deg)',
          bgcolor: flag.status === 'unresolved' ? 'warning.main' : 'text.disabled',
          flex: 'none'
        }}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {flagReasonLabel(flag.reason)} · {flag.detail}
          </Typography>
          <Chip
            size="small"
            label={FLAG_STATUS_LABEL[flag.status]}
            sx={{
              bgcolor: chipSx.bgcolor,
              color: chipSx.color,
              fontWeight: 500,
              height: 18,
              fontSize: 10.5
            }}
          />
        </Box>
        <Typography variant="mono" sx={{ fontSize: 11, color: 'text.disabled' }}>
          Flag {index + 1} of {total} · <TimeText seconds={timeS} />
        </Typography>
      </Box>

      {flag.status === 'unresolved' ? (
        <Button
          title="Accept — tracking was fine · A"
          onClick={onAccept}
          sx={{ height: 28, px: 1.25, gap: 0.75, border: 1, borderColor: 'surface.lineStrong' }}
        >
          <Symbol name="check" size={16} />
          Accept
          <Kbd>A</Kbd>
        </Button>
      ) : (
        <Button
          title="Reopen — remove this flag's corrections · R"
          onClick={onReopen}
          sx={{ height: 28, px: 1.25, gap: 0.75, border: 1, borderColor: 'surface.lineStrong' }}
        >
          <Symbol name="restart_alt" size={16} />
          Reopen
          <Kbd>R</Kbd>
        </Button>
      )}
      <Button
        title="Set position — then click the mouse · P"
        onClick={onSetPosition}
        variant="contained"
        sx={{ height: 28, px: 1.25, gap: 0.75, fontWeight: 600 }}
      >
        <Symbol name="my_location" size={16} />
        {flag.status === 'fixed' ? 'Set position again' : 'Set position'}
        <Kbd variant="onPrimary">P</Kbd>
      </Button>
    </Box>
  )
}
