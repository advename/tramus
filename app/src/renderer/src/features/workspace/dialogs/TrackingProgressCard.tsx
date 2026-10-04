import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

import type { Job } from '../../../api/types'
import { Kbd } from '../../../components/Kbd'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { SHORTCUTS } from '../../../lib/shortcutRegistry'

export interface TrackingProgressCardProps {
  job: Job
  onCancel: () => void
}

function mmss(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Tracking in progress (design: `showProgress`). */
export function TrackingProgressCard({
  job,
  onCancel
}: TrackingProgressCardProps): React.JSX.Element {
  const percent = Math.round(job.progress * 100)

  return (
    <Box
      sx={{
        position: 'absolute',
        left: '50%',
        bottom: 36,
        transform: 'translateX(-50%)',
        width: 'min(440px, calc(100% - 130px))',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: '12px',
        boxShadow: '0 16px 40px rgba(0,0,0,.4)',
        p: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography sx={{ fontWeight: 600 }}>Tracking {job.video_name}</Typography>
        <Typography variant="mono" sx={{ fontSize: 15 }}>
          {percent}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{ height: 4, borderRadius: '2px', bgcolor: 'surface.raised' }}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>Elapsed</Typography>
          <Typography variant="mono" sx={{ fontSize: 12.5 }}>
            {mmss(job.elapsed_s)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>Remaining</Typography>
          <Typography variant="mono" sx={{ fontSize: 12.5 }}>
            {job.remaining_s != null ? mmss(job.remaining_s) : '—'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>Speed</Typography>
          <Typography variant="mono" sx={{ fontSize: 12.5 }}>
            {job.fps != null ? `${Math.round(job.fps)} fps` : '—'}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.25 }}
      >
        <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
          You can look at the setup, not edit it.
        </Typography>
        <ShortcutTooltip title="Cancel tracking" shortcut={SHORTCUTS.cancelTracking.combo}>
          <Box
            component="button"
            onClick={onCancel}
            sx={{
              height: 28,
              px: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              border: '1px solid',
              borderColor: 'surface.lineStrong',
              borderRadius: '6px',
              bgcolor: 'transparent',
              color: 'text.primary',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            Cancel
            <Kbd>Esc</Kbd>
          </Box>
        </ShortcutTooltip>
      </Box>
    </Box>
  )
}
