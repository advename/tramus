import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

export interface RenameTemplateDialogProps {
  open: boolean
  initialName: string
  submitting: boolean
  onCancel: () => void
  onSubmit: (name: string) => void
}

/**
 * Renames a template — a plain text dialog, used from the Templates screen. The caller should
 * pass a `key` that changes with the target template (e.g. its id) so this remounts — and so its
 * local `name` state resets — whenever a different template is being renamed.
 */
export function RenameTemplateDialog({
  open,
  initialName,
  submitting,
  onCancel,
  onSubmit
}: RenameTemplateDialogProps): React.JSX.Element {
  const [name, setName] = useState(initialName)

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && !submitting

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="span">
          Rename template
        </Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSubmit) onSubmit(trimmed)
          }}
          sx={{ mt: 0.5 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!canSubmit} onClick={() => onSubmit(trimmed)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
