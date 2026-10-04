import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import { useBlocker } from 'react-router'

import { Kbd } from '../../../components/Kbd'
import { useShortcut } from '../../../lib/shortcuts'
import { SHORTCUTS } from '../../../lib/shortcutRegistry'

export interface UnsavedChangesDialogProps {
  videoId: string
  dirty: boolean
  fileName: string
  onSave: () => Promise<void>
  onDiscard: () => Promise<void>
}

/**
 * Blocks navigating away from this video's workspace while there are unsaved edits, and offers
 * Save / Don't save / Cancel (design: `showUnsaved`). Uses react-router's data-router blocker, so
 * it only fires for a real navigation away — switching steps within the same video isn't blocked.
 */
export function UnsavedChangesDialog({
  videoId,
  dirty,
  fileName,
  onSave,
  onDiscard
}: UnsavedChangesDialogProps): React.JSX.Element {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      currentLocation.pathname !== nextLocation.pathname &&
      !nextLocation.pathname.startsWith(`/videos/${videoId}/`)
  )
  const blocked = blocker.state === 'blocked'

  const cancel = (): void => {
    if (blocked) blocker.reset()
  }
  const discard = (): void => {
    void onDiscard().then(() => {
      if (blocked) blocker.proceed()
    })
  }
  const save = (): void => {
    void onSave().then(() => {
      if (blocked) blocker.proceed()
    })
  }

  useShortcut(SHORTCUTS.save.combo, () => save(), { enabled: blocked })

  return (
    <Dialog open={blocked} onClose={cancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="span">
          Save changes before leaving?
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          You have unsaved changes to {fileName}. If you don’t save, they will be lost.
        </DialogContentText>
      </DialogContent>
      <Box sx={{ display: 'flex', gap: 1, px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={discard} sx={{ color: 'error.main' }}>
          Don’t save
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={cancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} sx={{ gap: 1 }}>
          Save
          <Kbd variant="onPrimary">Ctrl+S</Kbd>
        </Button>
      </Box>
    </Dialog>
  )
}
