import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'
import type { SaveLabelInfo } from '../lib/session'

export interface SaveControlProps {
  info: SaveLabelInfo
  onSave: () => void
  saving: boolean
}

/** The save-state dot + label, and the Save button (design: `saveLabel`/`saveDot`/`onSave`). */
export function SaveControl({ info, onSave, saving }: SaveControlProps): React.JSX.Element {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          fontSize: 12,
          color: 'text.secondary',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
      >
        <Box
          component="span"
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            bgcolor: info.dot === 'warning' ? 'warning.main' : 'success.main'
          }}
        />
        <Typography component="span" sx={{ fontSize: 12 }}>
          {info.label}
        </Typography>
      </Box>
      <ShortcutTooltip title="Save" shortcut="mod+s">
        <Button
          variant="outlined"
          onClick={onSave}
          loading={saving}
          startIcon={<Symbol name="save" size={16} />}
          sx={{ borderColor: 'surface.lineStrong', color: 'text.primary', flexShrink: 0 }}
        >
          Save
        </Button>
      </ShortcutTooltip>
    </>
  )
}
