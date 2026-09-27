import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { Symbol } from '../../../components/Symbol'

export interface TrackingStoppedCardProps {
  kind: 'failed' | 'cancelled'
  errorMessage?: string | null
  onRetry: () => void
  onBackToSetup: () => void
}

/** Tracking finished with `failed`/`cancelled` (design: `showStopped`). */
export function TrackingStoppedCard({
  kind,
  errorMessage,
  onRetry,
  onBackToSetup
}: TrackingStoppedCardProps): React.JSX.Element {
  const failed = kind === 'failed'

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
        borderColor: failed ? 'error.main' : 'surface.lineStrong',
        borderRadius: '12px',
        boxShadow: '0 16px 40px rgba(0,0,0,.4)',
        p: '14px 16px',
        display: 'flex',
        gap: 1.5
      }}
    >
      <Symbol name={failed ? 'error' : 'cancel'} size={22} sx={{ color: failed ? 'error.main' : 'text.secondary' }} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>
          {failed ? 'Tracking failed' : 'Tracking cancelled'}
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          {failed
            ? (errorMessage ?? 'Something went wrong. Your setup is unchanged.')
            : 'Your setup is unchanged. Nothing from this run was kept.'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={onRetry} sx={{ height: 28, fontWeight: 600 }}>
            {failed ? 'Try again' : 'Track again'}
          </Button>
          <Button variant="outlined" onClick={onBackToSetup} sx={{ height: 28 }}>
            Back to setup
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
