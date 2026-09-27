import type { ReactNode } from 'react'
import Box, { type BoxProps } from '@mui/material/Box'
import { alpha } from '@mui/material/styles'

import { extendSx } from '../lib/sx'

export interface KbdProps extends Omit<BoxProps<'span'>, 'children'> {
  children: ReactNode
  /**
   * `"default"` (border/text from the surrounding panel — the usual case, including inside
   * outlined buttons) or `"onPrimary"` (for use inside a filled primary button, e.g. the
   * "Track ⌃T" button — matches the button's contrast text instead of the page's text colour).
   */
  variant?: 'default' | 'onPrimary'
}

/** An inline chip showing a keyboard shortcut, e.g. `<Kbd>Ctrl+S</Kbd>`. See `lib/shortcuts.ts`'s `formatShortcut`. */
export function Kbd({ children, variant = 'default', sx, ...rest }: KbdProps): React.JSX.Element {
  return (
    <Box
      component="span"
      {...rest}
      sx={[
        (theme) => ({
          display: 'inline-block',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10.5px',
          fontWeight: 500,
          lineHeight: 1.5,
          padding: '0 5px',
          borderRadius: '4px',
          border: '1px solid',
          borderColor:
            variant === 'onPrimary'
              ? alpha(theme.palette.primary.contrastText, 0.3)
              : theme.palette.divider,
          color: variant === 'onPrimary' ? theme.palette.primary.contrastText : 'inherit'
        }),
        ...extendSx(sx)
      ]}
    >
      {children}
    </Box>
  )
}
