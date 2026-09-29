import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'

import type { ZoneUnit } from '../lib/units'

export interface UnitToggleProps {
  unit: ZoneUnit
  onChange: (unit: ZoneUnit) => void
  /** True when there's no scale calibration to convert with — disables the `cm` option. */
  disabledCm: boolean
}

/**
 * The px/cm display-unit toggle shared by every setup field with a scale-dependent unit: zone
 * geometry (`SelectedZonePanel`) and the minimum mouse size (`DetectionSection`).
 */
export function UnitToggle({ unit, onChange, disabledCm }: UnitToggleProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: '6px',
        overflow: 'hidden'
      }}
    >
      {(['px', 'cm'] as const).map((u) => (
        <ButtonBase
          key={u}
          disabled={u === 'cm' && disabledCm}
          onClick={() => onChange(u)}
          sx={{
            width: 28,
            height: 20,
            fontSize: 10.5,
            fontWeight: 500,
            bgcolor: unit === u ? 'surface.hover' : 'transparent',
            color: unit === u ? 'text.primary' : 'text.disabled'
          }}
        >
          {u}
        </ButtonBase>
      ))}
    </Box>
  )
}
