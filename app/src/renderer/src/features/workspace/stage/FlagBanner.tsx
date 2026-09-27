import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { Symbol } from '../../../components/Symbol'
import { TimeText } from '../../../components/TimeText'
import type { FlagView } from '../../../api/types'
import { flagReasonLabel } from '../lib/flags'

export interface FlagBannerProps {
  flag: FlagView
  index: number
  total: number
  timeS: number
  onAccept: () => void
  onSetPosition: () => void
}

/**
 * The banner shown over the stage when the playhead is inside an unresolved flag (Review only).
 * "Accept" records it was fine; "Set position" switches to the position tool.
 */
export function FlagBanner({
  flag,
  index,
  total,
  timeS,
  onAccept,
  onSetPosition
}: FlagBannerProps): React.JSX.Element {
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
        borderColor: (theme) => alpha(theme.palette.warning.main, 0.55),
        borderRadius: 2.25,
        boxShadow: 8,
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100% - 90px)'
      }}
    >
      <Box sx={{ width: 9, height: 9, transform: 'rotate(45deg)', bgcolor: 'warning.main', flex: 'none' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {flagReasonLabel(flag.reason)} · {flag.detail}
        </Typography>
        <Typography variant="mono" sx={{ fontSize: 11, color: 'text.disabled' }}>
          Flag {index + 1} of {total} · <TimeText seconds={timeS} />
        </Typography>
      </Box>
      <Button
        title="Accept — tracking was fine · A"
        onClick={onAccept}
        startIcon={<Symbol name="check" size={16} />}
        sx={{ height: 28, px: 1.25, border: 1, borderColor: 'surface.lineStrong' }}
      >
        Accept
      </Button>
      <Button
        title="Set position · P — then click the mouse"
        onClick={onSetPosition}
        variant="contained"
        startIcon={<Symbol name="my_location" size={16} />}
        sx={{ height: 28, px: 1.25, fontWeight: 600 }}
      >
        Set position
      </Button>
    </Box>
  )
}
