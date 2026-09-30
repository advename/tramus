import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import { EmptyState } from '../../components/EmptyState'
import { Symbol } from '../../components/Symbol'
import { isMac } from '../../lib/platform'

const PRIVACY_LINE =
  'Tramus only reads folders you open, and processes everything locally on this computer — nothing is uploaded or sent anywhere else.'

export interface AccessDeniedStateProps {
  /** The engine's `detail` message — already platform-worded (see `api/errors.py`). */
  detail: string
  /** True while a retry (`refetch()`) is in flight. */
  isRetrying: boolean
  onRetry: () => void
  onChooseFolder: () => void
}

/**
 * Shown instead of the generic Library error when the engine reports `403` — the OS (in
 * practice, macOS's per-folder privacy protection) refused to read the folder. Unlike the
 * generic error, "Try again" alone can never succeed here without the user doing something
 * about permissions first, so this offers the two real ways out plus a retry.
 */
export function AccessDeniedState({
  detail,
  isRetrying,
  onRetry,
  onChooseFolder
}: AccessDeniedStateProps): React.JSX.Element {
  return (
    <EmptyState
      icon="lock"
      title="Tramus can't access this folder"
      description={
        <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography component="span" variant="body2" color="text.secondary">
            {detail}
          </Typography>
          <Typography component="span" variant="caption" color="text.disabled">
            {PRIVACY_LINE}
          </Typography>
        </Box>
      }
      action={
        <>
          {isMac() ? (
            <Button
              variant="outlined"
              onClick={() => void window.tramus.shell.openPrivacySettings()}
              startIcon={<Symbol name="settings" size={17} />}
            >
              Open Privacy Settings
            </Button>
          ) : null}
          <Button
            variant="outlined"
            onClick={onChooseFolder}
            startIcon={<Symbol name="folder_open" size={17} />}
          >
            Choose another folder
          </Button>
          <Button
            variant="contained"
            onClick={onRetry}
            disabled={isRetrying}
            startIcon={
              isRetrying ? (
                <CircularProgress size={15} color="inherit" />
              ) : (
                <Symbol name="refresh" size={17} />
              )
            }
          >
            {isRetrying ? 'Trying again…' : 'Try again'}
          </Button>
        </>
      }
    />
  )
}
