import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { Symbol } from '../../../components/Symbol'

export interface FileChangedCardProps {
  onKeep: () => void
  onRetrack: () => void
}

/** The video file changed since it was analysed (design: `showChanged`). */
export function FileChangedCard({ onKeep, onRetrack }: FileChangedCardProps): React.JSX.Element {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: 60,
        right: 12,
        top: 12,
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        p: '12px 14px',
        bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
        border: 1,
        borderColor: (t) => alpha(t.palette.warning.main, 0.6),
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,.3)'
      }}
    >
      <Symbol name="warning" size={20} sx={{ color: 'warning.main' }} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography sx={{ fontWeight: 600 }}>Video file changed since it was analysed</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          The saved track may no longer match these frames.
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onKeep} sx={{ height: 28 }}>
          Keep results
        </Button>
        <Button variant="contained" onClick={onRetrack} sx={{ height: 28, fontWeight: 600 }}>
          Re-track
        </Button>
      </Box>
    </Box>
  )
}
