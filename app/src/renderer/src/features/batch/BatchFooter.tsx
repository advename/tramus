import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { Symbol } from '../../components/Symbol'

export interface BatchFooterProps {
  text: string
  onBack?: () => void
  nextLabel?: string
  onNext?: () => void
  nextDisabled?: boolean
}

/** The Batch screen's shared footer: context text + Back/Next, per `designs/Screens.dc.html`. */
export function BatchFooter({ text, onBack, nextLabel, onNext, nextDisabled }: BatchFooterProps): React.JSX.Element {
  return (
    <Box
      component="footer"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 2,
        py: 1.25,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flex: 'none',
        flexWrap: 'wrap'
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: 12.5, flex: 1, minWidth: 200 }}>
        {text}
      </Typography>
      {onBack ? (
        <Button variant="outlined" onClick={onBack} sx={{ height: 32, px: 1.75, fontWeight: 500 }}>
          Back
        </Button>
      ) : null}
      {onNext && nextLabel ? (
        <Button
          variant="contained"
          onClick={onNext}
          disabled={nextDisabled}
          endIcon={<Symbol name="arrow_forward" size={17} />}
          sx={{ height: 32, px: 1.75, fontWeight: 600 }}
        >
          {nextLabel}
        </Button>
      ) : null}
    </Box>
  )
}
