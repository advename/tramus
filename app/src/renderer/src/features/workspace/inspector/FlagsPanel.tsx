import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { alpha, type Theme } from '@mui/material/styles'

import type { FlagView } from '../../../api/types'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'
import { formatClockTime, formatVideoTime } from '../../../lib/time'
import {
  countByStatus,
  filterFlags,
  flagReasonLabel,
  FLAG_STATUS_LABEL,
  MANY_FLAGS_THRESHOLD,
  nextFlag
} from '../lib/flags'
import type { FlagFilter } from '../state/workspaceStore'

export interface FlagsPanelProps {
  flags: FlagView[]
  recordedAt: string | null
  filter: FlagFilter
  onFilterChange: (filter: FlagFilter) => void
  selectedFlagId: string | null
  currentFrame: number
  onGoToFlag: (flag: FlagView) => void
  onAdjustDetection: () => void
}

const FILTERS: readonly FlagFilter[] = ['all', 'unresolved', 'fixed', 'accepted']
const FILTER_LABEL: Record<FlagFilter, string> = {
  all: 'All',
  unresolved: 'Unresolved',
  fixed: 'Fixed',
  accepted: 'Accepted'
}

function statusChipSx(status: FlagView['status']): {
  bgcolor: string | ((t: Theme) => string)
  color: string
} {
  switch (status) {
    case 'unresolved':
      return { bgcolor: (t: Theme) => alpha(t.palette.warning.main, 0.15), color: 'warning.main' }
    case 'fixed':
      return { bgcolor: (t: Theme) => alpha(t.palette.success.main, 0.16), color: 'success.main' }
    case 'accepted':
      return { bgcolor: 'surface.raised', color: 'text.secondary' }
  }
}

/** Review › Flags tab (design: `showFlags`, `flagChips`, `flagRows`). */
export function FlagsPanel({
  flags,
  recordedAt,
  filter,
  onFilterChange,
  selectedFlagId,
  currentFrame,
  onGoToFlag,
  onAdjustDetection
}: FlagsPanelProps): React.JSX.Element {
  const counts = countByStatus(flags)
  const rows = filterFlags(flags, filter)
  const isMany = flags.length > MANY_FLAGS_THRESHOLD

  return (
    <Box>
      <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {isMany ? (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              p: 1.25,
              borderRadius: '8px',
              bgcolor: (t) => alpha(t.palette.warning.main, 0.15),
              fontSize: 12
            }}
          >
            <Symbol name="warning" size={17} sx={{ color: 'warning.main', flexShrink: 0 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <span>This many flags usually means the detection settings don’t suit this video.</span>
              <Link
                component="button"
                onClick={onAdjustDetection}
                sx={{ fontWeight: 600, color: 'text.primary', textAlign: 'left' }}
              >
                Adjust detection in Setup
              </Link>
            </Box>
          </Box>
        ) : null}

        {flags.length > 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
            <ShortcutTooltip title="Previous flag" shortcut="[">
              <ButtonBase
                onClick={() => {
                  const target = nextFlag(flags, currentFrame, -1)
                  if (target) onGoToFlag(target)
                }}
                sx={{
                  height: 28,
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: 'surface.lineStrong',
                  fontSize: 12.5,
                  fontWeight: 500,
                  gap: 0.5
                }}
              >
                <Symbol name="chevron_left" size={16} />
                Previous
              </ButtonBase>
            </ShortcutTooltip>
            <ShortcutTooltip title="Next flag" shortcut="]">
              <ButtonBase
                onClick={() => {
                  const target = nextFlag(flags, currentFrame, 1)
                  if (target) onGoToFlag(target)
                }}
                sx={{
                  height: 28,
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: 'surface.lineStrong',
                  fontSize: 12.5,
                  fontWeight: 500,
                  gap: 0.5
                }}
              >
                Next
                <Symbol name="chevron_right" size={16} />
              </ButtonBase>
            </ShortcutTooltip>
          </Box>
        ) : null}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {FILTERS.map((f) => (
            <ButtonBase
              key={f}
              onClick={() => onFilterChange(f)}
              sx={{
                height: 24,
                px: 1.25,
                display: 'flex',
                alignItems: 'center',
                gap: 0.625,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: filter === f ? 'primary.main' : 'surface.lineStrong',
                bgcolor: filter === f ? (t) => alpha(t.palette.primary.main, 0.13) : 'transparent',
                fontSize: 11.5
              }}
            >
              {FILTER_LABEL[f]}
              <Typography variant="mono" component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>
                {counts[f]}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      </Box>

      {flags.length === 0 ? (
        <Box
          sx={{
            mx: 1.75,
            p: 2.75,
            border: '1px dashed',
            borderColor: 'surface.lineStrong',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            textAlign: 'center'
          }}
        >
          <Symbol name="check_circle" size={26} sx={{ color: 'success.main' }} />
          <Typography sx={{ fontWeight: 600 }}>No flags</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Tracking looked consistent for the whole trial. You can still scrub through and correct
            any frame.
          </Typography>
        </Box>
      ) : (
        rows.map((flag) => {
          const chipSx = statusChipSx(flag.status)
          const current = flag.id === selectedFlagId
          return (
            <Box
              key={flag.id}
              onClick={() => onGoToFlag(flag)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '10px 74px minmax(0,1fr) auto',
                alignItems: 'center',
                gap: 1.25,
                py: 0.875,
                px: 1.75,
                cursor: 'pointer',
                bgcolor: current ? (t) => alpha(t.palette.primary.main, 0.13) : 'transparent',
                '&:hover': { bgcolor: 'surface.hover' }
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  transform: 'rotate(45deg)',
                  bgcolor: flag.status === 'unresolved' ? 'warning.main' : 'text.disabled'
                }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <Typography variant="mono" sx={{ fontSize: 12 }}>
                  {formatVideoTime(flag.t_start_s)}
                </Typography>
                <Typography variant="mono" sx={{ fontSize: 10.5, color: 'text.disabled' }}>
                  {recordedAt ? formatClockTime(recordedAt, flag.t_start_s) : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
                <Typography
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}
                >
                  {flagReasonLabel(flag.reason)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    color: 'text.disabled',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {flag.detail}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={FLAG_STATUS_LABEL[flag.status]}
                sx={{ bgcolor: chipSx.bgcolor, color: chipSx.color, fontWeight: 500, height: 20 }}
              />
            </Box>
          )
        })
      )}
    </Box>
  )
}
