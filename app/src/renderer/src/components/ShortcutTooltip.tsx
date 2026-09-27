import Stack from '@mui/material/Stack'
import Tooltip, { type TooltipProps } from '@mui/material/Tooltip'

import { formatShortcut } from '../lib/shortcuts'
import { Kbd } from './Kbd'

export interface ShortcutTooltipProps extends Omit<TooltipProps, 'title'> {
  /** The label, e.g. `"Save"`. */
  title: string
  /** A shortcut combo (see `lib/shortcuts.ts`), e.g. `"mod+s"`. Omit for a plain label tooltip. */
  shortcut?: string
}

/**
 * The design's standard tooltip: a label with its keyboard shortcut shown as a chip, e.g.
 * "Save · Ctrl+S". Use on every frequent icon-only action (nav rail, canvas tools, transport).
 * Wraps `Tooltip`, so `enterDelay`/`placement`/etc. all work as usual; the default `enterDelay`
 * of 500 ms comes from the theme (`createAppTheme.ts`'s `MuiTooltip` default props).
 */
export function ShortcutTooltip({
  title,
  shortcut,
  children,
  ...tooltipProps
}: ShortcutTooltipProps): React.JSX.Element {
  return (
    <Tooltip
      {...tooltipProps}
      title={
        <Stack direction="row" alignItems="center" gap={0.75} component="span">
          <span>{title}</span>
          {shortcut ? (
            <Kbd sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'inherit' }}>
              {formatShortcut(shortcut)}
            </Kbd>
          ) : null}
        </Stack>
      }
    >
      {children}
    </Tooltip>
  )
}
