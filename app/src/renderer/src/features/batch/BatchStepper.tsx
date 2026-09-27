import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'

import { Symbol } from '../../components/Symbol'
import type { BatchStep } from './lib'

const STEPS: readonly { key: BatchStep; label: string }[] = [
  { key: 'choose', label: 'Choose' },
  { key: 'check', label: 'Check' },
  { key: 'run', label: 'Run' },
  { key: 'finish', label: 'Finish' }
]

export interface BatchStepperProps {
  step: BatchStep
}

/** The Batch header's horizontal step indicator (`designs/Screens.dc.html` §isBatch header). */
export function BatchStepper({ step }: BatchStepperProps): React.JSX.Element {
  const activeIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 'none' }}>
      {STEPS.map((s, index) => (
        <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 22,
              height: 22,
              boxSizing: 'border-box',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              fontWeight: 600,
              bgcolor:
                index === activeIndex
                  ? 'primary.main'
                  : index < activeIndex
                    ? (theme) => alpha(theme.palette.primary.main, 0.13)
                    : 'transparent',
              color: index === activeIndex ? 'primary.contrastText' : 'text.secondary',
              border: '1px solid',
              borderColor: index === activeIndex ? 'primary.main' : 'surface.lineStrong'
            }}
          >
            {index < activeIndex ? <Symbol name="check" size={14} /> : index + 1}
          </Box>
          <Box
            component="span"
            sx={{ fontWeight: 500, color: index <= activeIndex ? 'text.primary' : 'text.disabled' }}
          >
            {s.label}
          </Box>
          {index < STEPS.length - 1 ? (
            <Box sx={{ width: 28, height: '1px', bgcolor: 'surface.lineStrong', mx: 0.5 }} />
          ) : null}
        </Box>
      ))}
    </Box>
  )
}
