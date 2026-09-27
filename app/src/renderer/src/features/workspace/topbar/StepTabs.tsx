import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import { alpha } from '@mui/material/styles'

import { Symbol } from '../../../components/Symbol'
import { WORKSPACE_STEPS, type WorkspaceStep } from '../state/workspaceStore'

const STEP_LABEL: Record<WorkspaceStep, string> = {
  setup: 'Setup',
  tracking: 'Track',
  review: 'Review',
  results: 'Results'
}

export interface StepTabsProps {
  step: WorkspaceStep
  /** Steps after Setup are disabled while the setup is empty. */
  disabledAfterSetup: boolean
  onSelect: (step: WorkspaceStep) => void
}

/** The design's segmented step control — a restyled non-linear stepper. */
export function StepTabs({ step, disabledAfterSetup, onSelect }: StepTabsProps): React.JSX.Element {
  const currentIndex = WORKSPACE_STEPS.indexOf(step)

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.25,
        p: 0.375,
        borderRadius: '9px',
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        flexShrink: 0
      }}
    >
      {WORKSPACE_STEPS.map((s, index) => {
        const active = s === step
        const done = index < currentIndex
        const disabled = disabledAfterSetup && index > 0
        return (
          <ButtonBase
            key={s}
            disabled={disabled}
            onClick={() => onSelect(s)}
            sx={[
              {
                display: 'flex',
                alignItems: 'center',
                gap: 0.875,
                height: 28,
                pl: 0.75,
                pr: 1.375,
                borderRadius: '6px',
                fontSize: 12.5,
                fontWeight: 500
              },
              active
                ? { bgcolor: 'surface.raised', boxShadow: (t) => `0 0 0 1px ${t.palette.surface.lineStrong}` }
                : {},
              disabled ? { color: 'text.disabled' } : { color: active ? 'text.primary' : 'text.secondary' }
            ]}
          >
            <Box
              component="span"
              sx={[
                {
                  width: 18,
                  height: 18,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 10.5,
                  fontWeight: 600,
                  border: '1px solid'
                },
                active
                  ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderColor: 'primary.main' }
                  : done
                    ? (t) => ({
                        bgcolor: alpha(t.palette.primary.main, 0.13),
                        color: 'text.secondary',
                        borderColor: 'transparent'
                      })
                    : { color: 'text.secondary', borderColor: 'surface.lineStrong' }
              ]}
            >
              {done ? <Symbol name="check" size={13} /> : index + 1}
            </Box>
            {STEP_LABEL[s]}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
