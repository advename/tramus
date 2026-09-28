import { type RefObject } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import type { FlagView, TrialWindow } from '../../../api/types'
import { Symbol } from '../../../components/Symbol'
import { formatVideoTime } from '../../../lib/time'
import { buildTicks, percentOfDuration, widthOfDuration } from '../lib/timelineScale'
import { RangePopover } from './RangePopover'

export interface ZoneLaneData {
  zoneId: string
  name: string
  color: string
  segments: { startS: number; endS: number }[]
}

export interface CorrectionMark {
  startS: number
  endS: number
  title: string
}

export interface TimelineTracksProps {
  trackRef: RefObject<HTMLDivElement | null>
  onTrackPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  zoom: number
  pxPerSecond: number
  /** Height (px) of each zone/flag/correction lane row — grows with the panel, see `Timeline.tsx`. */
  laneRowHeight: number
  durationS: number
  currentTimeS: number
  trial: TrialWindow
  zoneLanes: ZoneLaneData[]
  showZoneLanes: boolean
  flags: readonly FlagView[]
  showFlagLane: boolean
  selectedFlagId: string | null
  onFlagClick: (flag: FlagView) => void
  correctionMarks: readonly CorrectionMark[]
  processed: { startS: number; endS: number } | null
  filmstripUrl: string | null
  range: { startS: number; endS: number } | null
  rangeText: string
  rangeEditable: boolean
  onFillRange: () => void
  onHideRange: () => void
  onClearRange: () => void
}

export const LABEL_COLUMN_WIDTH = 128

/**
 * The timeline's tracks area: label column + a horizontally-scrolling ruler/lanes area whose
 * content width is `zoom × 100%` (so zoom is plain CSS, and every lane position is a `left`
 * percentage of `durationS` — see `lib/timelineScale.ts`).
 */
export function TimelineTracks({
  trackRef,
  onTrackPointerDown,
  zoom,
  pxPerSecond,
  laneRowHeight,
  durationS,
  currentTimeS,
  trial,
  zoneLanes,
  showZoneLanes,
  flags,
  showFlagLane,
  selectedFlagId,
  onFlagClick,
  correctionMarks,
  processed,
  filmstripUrl,
  range,
  rangeText,
  rangeEditable,
  onFillRange,
  onHideRange,
  onClearRange
}: TimelineTracksProps): React.JSX.Element {
  const ticks = buildTicks(durationS, pxPerSecond)
  const pct = (t: number): string => percentOfDuration(t, durationS)
  const widthPct = (deltaS: number): string => widthOfDuration(deltaS, durationS)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px minmax(0,1fr)`,
        minWidth: 0,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto'
      }}
    >
      {/* Label column */}
      <Box
        sx={{
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          fontSize: 11.5,
          color: 'text.secondary',
          pb: 0.75
        }}
      >
        <Box sx={{ height: 20, borderBottom: 1, borderColor: 'divider' }} />
        <Box sx={{ height: 34, display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5 }}>
          <Symbol name="movie" size={15} sx={{ color: 'text.disabled' }} />
          Video
        </Box>
        {zoneLanes.map((lane) => (
          <Box
            key={lane.zoneId}
            sx={{
              height: laneRowHeight,
              display: 'flex',
              alignItems: 'center',
              gap: 0.875,
              px: 1.5
            }}
          >
            <Box
              sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: lane.color, flex: 'none' }}
            />
            <Box
              component="span"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {lane.name}
            </Box>
          </Box>
        ))}
        {showFlagLane && (
          <>
            <Box sx={{ height: 18, display: 'flex', alignItems: 'center', gap: 0.875, px: 1.5 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  transform: 'rotate(45deg)',
                  bgcolor: 'warning.main',
                  flex: 'none'
                }}
              />
              Flags
              <Typography variant="mono" sx={{ color: 'text.disabled', fontSize: 11 }}>
                {flags.filter((f) => f.status === 'unresolved').length}
              </Typography>
            </Box>
            <Box
              sx={{
                height: laneRowHeight,
                display: 'flex',
                alignItems: 'center',
                gap: 0.875,
                px: 1.5
              }}
            >
              <Box sx={{ width: 8, height: 3, bgcolor: 'primary.main', flex: 'none' }} />
              Corrections
            </Box>
          </>
        )}
      </Box>

      {/* Horizontally-scrolling ruler + lanes (vertical scroll, if any, is on the outer grid so
          the label column scrolls in lockstep). */}
      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
        <Box
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          sx={{
            position: 'relative',
            width: `${zoom * 100}%`,
            minWidth: '100%',
            pb: 0.75,
            cursor: 'text'
          }}
        >
          {/* Ruler */}
          <Box sx={{ position: 'relative', height: 20, borderBottom: 1, borderColor: 'divider' }}>
            {ticks.map((tick) => (
              <Box
                key={tick.t}
                sx={{
                  position: 'absolute',
                  left: pct(tick.t),
                  bottom: 0,
                  width: '1px',
                  height: tick.major ? 8 : 4,
                  bgcolor: 'surface.lineStrong'
                }}
              >
                {tick.major && (
                  <Typography
                    variant="mono"
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: -14,
                      pl: 0.5,
                      fontSize: 10,
                      color: 'text.disabled',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tick.label}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>

          {/* Video strip */}
          <Box sx={{ position: 'relative', height: 34 }}>
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 3,
                bottom: 3,
                borderRadius: 0.5,
                bgcolor: 'common.black',
                backgroundImage: filmstripUrl ? `url(${filmstripUrl})` : undefined,
                backgroundSize: 'auto 100%',
                backgroundRepeat: 'repeat-x'
              }}
            />
            {processed && (
              <Box
                sx={{
                  position: 'absolute',
                  left: pct(processed.startS),
                  width: widthPct(Math.max(0, processed.endS - processed.startS)),
                  top: 3,
                  bottom: 3,
                  backgroundImage: (theme) =>
                    `repeating-linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.5)} 0 4px, transparent 4px 8px)`,
                  borderRight: 2,
                  borderColor: 'primary.main'
                }}
              />
            )}
          </Box>

          {/* Zone lanes */}
          {showZoneLanes &&
            zoneLanes.map((lane) => (
              <Box key={lane.zoneId} sx={{ position: 'relative', height: laneRowHeight }}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 8,
                    height: '1px',
                    bgcolor: 'divider'
                  }}
                />
                {lane.segments.map((seg, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: 'absolute',
                      left: pct(seg.startS),
                      width: widthPct(Math.max(0, seg.endS - seg.startS)),
                      top: 3,
                      height: 10,
                      borderRadius: 0.5,
                      bgcolor: lane.color
                    }}
                  />
                ))}
              </Box>
            ))}

          {/* Flags + corrections lanes */}
          {showFlagLane && (
            <>
              <Box sx={{ position: 'relative', height: 18 }}>
                {flags.map((flag) => (
                  <Box
                    key={flag.id}
                    data-no-drag
                    title={`${formatVideoTime(flag.t_start_s)} · ${flag.reason}`}
                    onClick={() => onFlagClick(flag)}
                    sx={{
                      position: 'absolute',
                      left: pct(flag.t_start_s),
                      top: 5,
                      width: 8,
                      height: 8,
                      ml: '-4px',
                      transform: 'rotate(45deg)',
                      bgcolor: flag.status === 'unresolved' ? 'warning.main' : 'text.disabled',
                      boxShadow:
                        flag.id === selectedFlagId
                          ? (theme) =>
                              `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 3.5px ${theme.palette.warning.main}`
                          : 'none',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ position: 'relative', height: laneRowHeight }}>
                {correctionMarks.map((mark, i) => (
                  <Box
                    key={i}
                    title={mark.title}
                    sx={{
                      position: 'absolute',
                      left: pct(mark.startS),
                      width:
                        mark.endS > mark.startS ? widthPct(mark.endS - mark.startS) : undefined,
                      minWidth: 2,
                      top: 6,
                      height: 4,
                      borderRadius: 0.5,
                      bgcolor: 'primary.main'
                    }}
                  />
                ))}
              </Box>
            </>
          )}

          {/* Trial dimming */}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 20,
              bottom: 0,
              width: pct(trial.start_s),
              bgcolor: 'surface.dim',
              pointerEvents: 'none'
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: pct(trial.end_s),
              right: 0,
              top: 20,
              bottom: 0,
              bgcolor: 'surface.dim',
              pointerEvents: 'none'
            }}
          />

          {/* Range selection + popover */}
          {range && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  left: pct(range.startS),
                  width: widthPct(Math.max(0, range.endS - range.startS)),
                  top: 20,
                  bottom: 0,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                  borderLeft: 1,
                  borderRight: 1,
                  borderColor: 'primary.main',
                  pointerEvents: 'none'
                }}
              />
              <RangePopover
                left={pct(range.startS)}
                rangeText={rangeText}
                editable={rangeEditable}
                onFill={onFillRange}
                onHide={onHideRange}
                onClear={onClearRange}
              />
            </>
          )}

          {/* Trial handles */}
          <TrialHandle side="start" left={pct(trial.start_s)} />
          <TrialHandle side="end" left={pct(trial.end_s)} />

          {/* Playhead */}
          <Box
            sx={{
              position: 'absolute',
              left: pct(currentTimeS),
              top: 0,
              bottom: 0,
              width: 0,
              pointerEvents: 'none',
              zIndex: 2
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: -6,
                top: 3,
                width: 12,
                height: 13,
                bgcolor: 'text.primary',
                borderRadius: '3px 3px 6px 6px'
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: -0.5,
                top: 14,
                bottom: 0,
                width: '1px',
                bgcolor: 'text.primary'
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function TrialHandle({ side, left }: { side: 'start' | 'end'; left: string }): React.JSX.Element {
  const isStart = side === 'start'
  return (
    <Box
      data-drag={side}
      title={isStart ? 'Trial start — drag, or press I' : 'Trial end — drag, or press O'}
      sx={{
        position: 'absolute',
        left,
        top: 20,
        bottom: 0,
        width: 12,
        ml: isStart ? '-12px' : 0,
        cursor: 'ew-resize'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          [isStart ? 'right' : 'left']: 0,
          top: 0,
          bottom: 0,
          width: '2px',
          bgcolor: 'primary.main'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          [isStart ? 'right' : 'left']: 0,
          top: 3,
          height: 28,
          width: 10,
          bgcolor: 'primary.main',
          borderRadius: isStart ? '4px 0 0 4px' : '0 4px 4px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px'
        }}
      >
        <Box sx={{ width: '1px', height: 10, bgcolor: 'primary.contrastText', opacity: 0.5 }} />
        <Box sx={{ width: '1px', height: 10, bgcolor: 'primary.contrastText', opacity: 0.5 }} />
      </Box>
    </Box>
  )
}
