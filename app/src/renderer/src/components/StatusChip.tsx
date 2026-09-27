import Box from '@mui/material/Box'
import Chip, { type ChipProps } from '@mui/material/Chip'
import { alpha, type Theme, useTheme } from '@mui/material/styles'

import { extendSx } from '../lib/sx'

/** Mirrors the engine's `VideoStatus` (see `docs/architecture.md` §6, `video_status`). */
export type VideoStatus = 'new' | 'set_up' | 'tracked' | 'reviewed' | 'exported'

const STATUS_LABEL: Record<VideoStatus, string> = {
  new: 'New',
  set_up: 'Set up',
  tracked: 'Tracked',
  reviewed: 'Reviewed',
  exported: 'Exported'
}

interface StatusStyle {
  dot: string
  bg: string
  border: string
  fg: string
}

// Colours from the design's `ST` map (Screens.dc.html): [dot, background, border, text].
function statusStyle(theme: Theme, status: VideoStatus): StatusStyle {
  const { palette } = theme
  switch (status) {
    case 'new':
      return {
        dot: palette.text.disabled,
        bg: 'transparent',
        border: palette.surface.lineStrong,
        fg: palette.text.secondary
      }
    case 'set_up':
      return {
        dot: palette.text.secondary,
        bg: 'transparent',
        border: palette.surface.lineStrong,
        fg: palette.text.primary
      }
    case 'tracked':
      return {
        dot: palette.primary.main,
        bg: alpha(palette.primary.main, 0.13),
        border: 'transparent',
        fg: palette.text.primary
      }
    case 'reviewed':
      return {
        dot: palette.success.main,
        bg: alpha(palette.success.main, 0.14),
        border: 'transparent',
        fg: palette.text.primary
      }
    case 'exported':
      return {
        dot: palette.success.main,
        bg: 'transparent',
        border: alpha(palette.success.main, 0.5),
        fg: palette.success.main
      }
  }
}

export interface StatusChipProps extends Omit<ChipProps, 'label' | 'color' | 'variant' | 'icon'> {
  status: VideoStatus
}

/** The library's video-status chip: New · Set up · Tracked · Reviewed · Exported. */
export function StatusChip({ status, sx, ...rest }: StatusChipProps): React.JSX.Element {
  const theme = useTheme()
  const style = statusStyle(theme, status)

  return (
    <Chip
      {...rest}
      size="small"
      variant="outlined"
      label={STATUS_LABEL[status]}
      icon={
        <Box
          component="span"
          sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: style.dot }}
        />
      }
      sx={[
        {
          bgcolor: style.bg,
          borderColor: style.border,
          color: style.fg,
          fontWeight: 500
        },
        ...extendSx(sx)
      ]}
    />
  )
}
