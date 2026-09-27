import Typography, { type TypographyProps } from '@mui/material/Typography'

import { formatDuration, formatShortDuration, formatVideoTime } from '../lib/time'

export interface TimeTextProps extends Omit<TypographyProps, 'variant' | 'children'> {
  seconds: number
  /**
   * `"video"` (default) → `mm:ss.mmm`, for a playhead/absolute video-time readout.
   * `"duration"` → `m:ss.mmm`, for a length. `"short"` → `m:ss`, for a compact length.
   */
  format?: 'video' | 'duration' | 'short'
}

const FORMATTERS = {
  video: formatVideoTime,
  duration: formatDuration,
  short: formatShortDuration
} as const

/** A time readout in the `mono` typography variant (IBM Plex Mono, tabular-nums) — see `lib/time.ts`. */
export function TimeText({ seconds, format = 'video', ...rest }: TimeTextProps): React.JSX.Element {
  return (
    <Typography variant="mono" component="span" {...rest}>
      {FORMATTERS[format](seconds)}
    </Typography>
  )
}
