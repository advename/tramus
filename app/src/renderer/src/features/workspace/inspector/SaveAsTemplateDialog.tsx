import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'

import { useCreateTemplate } from '../../../api/queries'
import { notify, notifyError } from '../../../stores/notifications'

export interface SaveAsTemplateDialogProps {
  open: boolean
  videoId: string
  onClose: () => void
}

/** "Save as template…" — asks for a name, then saves the open session's setup as a template. */
export function SaveAsTemplateDialog({
  open,
  videoId,
  onClose
}: SaveAsTemplateDialogProps): React.JSX.Element {
  const [name, setName] = useState('')
  const createTemplate = useCreateTemplate()

  const handleClose = (): void => {
    setName('')
    onClose()
  }

  const handleSave = (): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    createTemplate.mutate(
      { name: trimmed, video_id: videoId },
      {
        onSuccess: () => {
          notify({ severity: 'success', title: `Saved template “${trimmed}”` })
          handleClose()
        },
        onError: (error) => notifyError('Couldn’t save the template', error)
      }
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Save as template</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
          }}
          sx={{ mt: 0.5 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!name.trim()}
          loading={createTemplate.isPending}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
