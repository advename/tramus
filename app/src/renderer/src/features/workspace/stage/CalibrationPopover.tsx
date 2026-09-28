import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import InputBase from '@mui/material/InputBase'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'

import { measureUnitToMm, type MeasureUnit } from '../lib/units'

export interface CalibrationPopoverProps {
  /** Screen coordinates (the finishing click) to anchor the popover near the drawn line. */
  anchorPosition: { top: number; left: number }
  /** The drawn line's length in video px, shown as a hint while the mm/cm value is typed. */
  lengthPx: number
  onSave: (lengthMm: number) => void
  onCancel: () => void
}

const UNITS: readonly MeasureUnit[] = ['mm', 'cm']

/**
 * "How long is this line?" — opens right after a Measure line is drawn (drag release or the
 * second click of click–click). Saving commits `Setup.calibration`; only rendered while a line
 * is pending, so `open` is implicitly `true` (see `VideoStage.tsx`).
 */
export function CalibrationPopover({
  anchorPosition,
  lengthPx,
  onSave,
  onCancel
}: CalibrationPopoverProps): React.JSX.Element {
  const [unit, setUnit] = useState<MeasureUnit>('mm')
  const [value, setValue] = useState('')

  const numeric = Number(value)
  const canSave = value.trim() !== '' && Number.isFinite(numeric) && numeric > 0

  const save = (): void => {
    if (!canSave) return
    onSave(measureUnitToMm(numeric, unit))
  }

  return (
    <Popover
      open
      onClose={onCancel}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{ paper: { sx: { p: 1.5, width: 236 } } }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.25 }}>
        How long is this line?
      </Typography>
      <Typography variant="mono" sx={{ fontSize: 11, color: 'text.disabled', mb: 1 }}>
        {Math.round(lengthPx)} px
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
        <InputBase
          autoFocus
          type="number"
          placeholder="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') onCancel()
          }}
          sx={{
            flex: 1,
            height: 32,
            px: 1,
            border: 1,
            borderColor: 'surface.lineStrong',
            borderRadius: '6px',
            fontSize: 13
          }}
        />
        <Box
          sx={{
            display: 'flex',
            border: 1,
            borderColor: 'surface.lineStrong',
            borderRadius: '6px',
            overflow: 'hidden'
          }}
        >
          {UNITS.map((u) => (
            <ButtonBase
              key={u}
              onClick={() => setUnit(u)}
              sx={{
                width: 34,
                height: 32,
                fontSize: 12,
                fontWeight: 500,
                bgcolor: unit === u ? 'surface.raised' : 'transparent',
                color: unit === u ? 'text.primary' : 'text.secondary'
              }}
            >
              {u}
            </ButtonBase>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
        <Button onClick={onCancel} sx={{ height: 30, fontSize: 12.5 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={save}
          sx={{ height: 30, fontSize: 12.5, fontWeight: 600 }}
        >
          Save
        </Button>
      </Box>
    </Popover>
  )
}
