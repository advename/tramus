import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface SettingsGroupProps {
  title: string
  children: ReactNode
}

export function SettingsGroup({ title, children }: SettingsGroupProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" color="text.disabled" sx={{ px: 0.25 }}>
        {title}
      </Typography>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px',
          bgcolor: 'background.paper'
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export interface SettingsRowProps {
  label: string
  help: string
  children: ReactNode
}

export function SettingsRow({ label, help, children }: SettingsRowProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.75,
        borderBottom: 1,
        borderColor: 'divider',
        flexWrap: 'wrap',
        '&:last-of-type': { borderBottom: 0 }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 220 }}>
        <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
        <Typography variant="caption" color="text.disabled" sx={{ textWrap: 'pretty' }}>
          {help}
        </Typography>
      </Box>
      {children}
    </Box>
  )
}
