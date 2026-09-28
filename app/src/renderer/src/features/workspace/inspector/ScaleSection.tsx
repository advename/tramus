import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'

import type { Setup } from '../../../api/types'
import { Symbol } from '../../../components/Symbol'
import type { SetupEditor } from '../data'
import { mmPerPxOf } from '../lib/units'
import { useWorkspaceStore } from '../state/workspaceStore'

export interface ScaleSectionProps {
  setup: Setup
  editor: SetupEditor
}

/**
 * The Setup inspector's scale calibration readout: a hint + "Measure" button when unset, or the
 * mm-per-px ratio with Edit/Remove once `setup.calibration` is set (design: `Scale` section,
 * placed after Arena — see `docs/architecture.md` §4, `Calibration`).
 */
export function ScaleSection({ setup, editor }: ScaleSectionProps): React.JSX.Element {
  const setSetupTool = useWorkspaceStore((s) => s.setSetupTool)
  const [editing, setEditing] = useState(false)
  const calibration = setup.calibration

  const removeCalibration = (): void => {
    void editor.commit({ ...setup, calibration: null }, 'Remove scale')
  }

  const saveLength = (lengthMm: number): void => {
    if (!calibration || !Number.isFinite(lengthMm) || lengthMm <= 0) {
      setEditing(false)
      return
    }
    setEditing(false)
    void editor.commit(
      { ...setup, calibration: { ...calibration, length_mm: lengthMm } },
      'Set scale'
    )
  }

  return (
    <Box sx={{ px: 1.75, pt: 1.75, pb: 1.5 }}>
      <Typography variant="overline" sx={{ color: 'text.disabled' }}>
        Scale
      </Typography>

      {!calibration ? (
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Draw a line over something of known length (e.g. the arena wall) to show zone sizes in
            cm instead of px.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Symbol name="straighten" size={16} />}
            onClick={() => setSetupTool('measure')}
            sx={{ alignSelf: 'flex-start' }}
          >
            Measure
          </Button>
        </Box>
      ) : (
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {editing ? (
            <EditLengthRow
              initialMm={calibration.length_mm}
              onSave={saveLength}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <Typography variant="mono" sx={{ fontSize: 12.5 }}>
                1 px = {(mmPerPxOf(calibration) ?? 0).toFixed(3)} mm
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
                Reference {calibration.length_mm} mm
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.25 }}>
                <Button variant="outlined" onClick={() => setEditing(true)} sx={{ flex: 1 }}>
                  Edit length
                </Button>
                <IconButton
                  title="Remove scale"
                  onClick={removeCalibration}
                  sx={{
                    color: 'text.disabled',
                    width: 32,
                    height: 32,
                    '&:hover': { color: 'error.main' }
                  }}
                >
                  <Symbol name="delete" size={16} />
                </IconButton>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}

function EditLengthRow({
  initialMm,
  onSave,
  onCancel
}: {
  initialMm: number
  onSave: (lengthMm: number) => void
  onCancel: () => void
}): React.JSX.Element {
  const [value, setValue] = useState(String(initialMm))
  const numeric = Number(value)
  const canSave = value.trim() !== '' && Number.isFinite(numeric) && numeric > 0

  return (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
      <InputBase
        autoFocus
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSave) onSave(numeric)
          if (e.key === 'Escape') onCancel()
        }}
        sx={{
          flex: 1,
          height: 30,
          px: 1,
          border: 1,
          borderColor: 'surface.lineStrong',
          borderRadius: '6px',
          fontSize: 13
        }}
      />
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>mm</Typography>
      <IconButton
        disabled={!canSave}
        onClick={() => onSave(numeric)}
        sx={{ width: 28, height: 28, color: 'primary.main' }}
      >
        <Symbol name="check" size={16} />
      </IconButton>
      <IconButton onClick={onCancel} sx={{ width: 28, height: 28, color: 'text.disabled' }}>
        <Symbol name="close" size={16} />
      </IconButton>
    </Box>
  )
}
