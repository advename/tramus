import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { Symbol } from './Symbol'

export interface EmptyStateProps {
  /** A Material Symbols name, e.g. `"video_file"`. */
  icon?: string
  title: string
  description?: ReactNode
  /** Usually one or two `<Button>`s. */
  action?: ReactNode
}

/** A centred "nothing here" placeholder — an empty library folder, a feature's "coming soon" stub, etc. */
export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1.25,
        maxWidth: 420,
        mx: 'auto',
        py: 8,
        px: 2
      }}
    >
      {icon ? <Symbol name={icon} size={36} sx={{ color: 'text.disabled' }} /> : null}
      <Typography variant="h6">{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}
      {action ? (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {action}
        </Box>
      ) : null}
    </Box>
  )
}
