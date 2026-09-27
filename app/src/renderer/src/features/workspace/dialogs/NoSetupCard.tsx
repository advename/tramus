import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { Kbd } from '../../../components/Kbd'
import { Symbol } from '../../../components/Symbol'

export interface NoSetupCardProps {
  onDrawArena: () => void
  onLoadTemplate: (anchor: HTMLElement) => void
}

/** Setup step, empty setup (design: `showNoSetup`). */
export function NoSetupCard({ onDrawArena, onLoadTemplate }: NoSetupCardProps): React.JSX.Element {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(380px, calc(100% - 140px))',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: '12px',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        boxShadow: '0 16px 40px rgba(0,0,0,.4)'
      }}
    >
      <Symbol name="highlight_alt" size={26} sx={{ color: 'text.secondary' }} />
      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>This video has no setup yet</Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        Draw the arena outline, then add zones. If this camera was used before, load its template
        instead.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
        <Button
          variant="contained"
          onClick={onDrawArena}
          sx={{ height: 32, px: 1.75, fontWeight: 600, gap: 0.75 }}
        >
          Draw arena
          <Kbd variant="onPrimary">A</Kbd>
        </Button>
        <Button
          variant="outlined"
          onClick={(e) => onLoadTemplate(e.currentTarget)}
          sx={{ height: 32, px: 1.75 }}
        >
          Load template…
        </Button>
      </Box>
    </Box>
  )
}
