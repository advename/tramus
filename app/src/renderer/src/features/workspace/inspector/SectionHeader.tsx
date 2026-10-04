import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

import { Symbol } from '../../../components/Symbol'
import { extendSx } from '../../../lib/sx'

export interface InfoTipProps {
  /** What the thing is called; used for the icon's accessible name. */
  label: string
  /** One or two short, plain sentences. */
  text: string
}

/** A small (i) icon that explains a control. Focusable, and the tip shows on hover and focus. */
export function InfoTip({ label, text }: InfoTipProps): React.JSX.Element {
  return (
    <Tooltip title={text} placement="top" arrow enterDelay={150}>
      <ButtonBase
        aria-label={`About ${label}`}
        sx={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          color: 'text.disabled',
          '&:hover, &:focus-visible': { color: 'text.secondary' }
        }}
      >
        <Symbol name="info" size={14} />
      </ButtonBase>
    </Tooltip>
  )
}

export interface SectionHeaderProps {
  title: string
  /** Tooltip text for the (i) icon; omit for no icon. */
  info?: string
  /** Controls on the right, e.g. a Reset or Add button. */
  actions?: React.ReactNode
  /** Overrides for the default padding (`px: 1.75, pt: 1.75, pb: 0.75`). */
  sx?: SxProps<Theme>
}

/** The overline title of a Setup sidebar section, with an optional (i) tip and right-hand actions. */
export function SectionHeader({ title, info, actions, sx }: SectionHeaderProps): React.JSX.Element {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.75,
          pt: 1.75,
          pb: 0.75
        },
        ...extendSx(sx)
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          {title}
        </Typography>
        {info ? <InfoTip label={title} text={info} /> : null}
      </Box>
      {actions}
    </Box>
  )
}
