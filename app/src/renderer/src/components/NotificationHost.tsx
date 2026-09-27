import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'

import { type NotificationSeverity, useNotificationStore } from '../stores/notifications'
import { Symbol } from './Symbol'

const DEFAULT_ICONS: Record<NotificationSeverity, string> = {
  success: 'check_circle',
  info: 'info',
  warning: 'warning',
  error: 'error'
}

const DEFAULT_AUTO_HIDE_MS = 6000

/**
 * Renders the head of the notification queue (`stores/notifications.ts`) as the design's
 * snackbar: coloured icon, title, optional body, optional action and a close button.
 * Mounted once in the app shell.
 */
export function NotificationHost(): React.JSX.Element {
  const current = useNotificationStore((s) => s.queue[0])
  const dismiss = useNotificationStore((s) => s.dismiss)

  const close = (): void => {
    if (current) dismiss(current.id)
  }

  return (
    <Snackbar
      key={current?.id}
      open={Boolean(current)}
      autoHideDuration={
        current?.autoHideMs === null ? null : (current?.autoHideMs ?? DEFAULT_AUTO_HIDE_MS)
      }
      onClose={(_event, reason) => {
        if (reason !== 'clickaway') close()
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Paper
        elevation={8}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 3,
          p: 3,
          pr: 2,
          minWidth: 360,
          maxWidth: 520,
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px'
        }}
      >
        {current && (
          <>
            <Symbol
              name={current.icon ?? DEFAULT_ICONS[current.severity]}
              size={20}
              sx={{ color: `${current.severity}.main`, mt: '1px' }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2">{current.title}</Typography>
              {current.message && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {current.message}
                </Typography>
              )}
            </Box>
            {current.action && (
              <Button
                size="small"
                onClick={() => {
                  current.action?.onClick()
                  close()
                }}
              >
                {current.action.label}
              </Button>
            )}
            <IconButton size="small" aria-label="Dismiss" onClick={close}>
              <Symbol name="close" size={18} />
            </IconButton>
          </>
        )}
      </Paper>
    </Snackbar>
  )
}
