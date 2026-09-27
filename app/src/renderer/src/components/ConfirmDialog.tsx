import type { ReactNode } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button in the theme's error colour, for destructive actions. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The design's confirmation dialog (e.g. "Save changes before leaving?" on navigating away with
 * unsaved edits). Confirming and cancelling are both the caller's responsibility — this
 * component only renders and reports the choice.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="span">
          {title}
        </Typography>
      </DialogTitle>
      {description ? (
        <DialogContent>
          <DialogContentText>{description}</DialogContentText>
        </DialogContent>
      ) : null}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
