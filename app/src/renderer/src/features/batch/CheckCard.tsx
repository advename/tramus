import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import { useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'

import type { Shape, Zone } from '../../api/types'
import { thumbnailUrl } from '../../api/urls'
import { ShortcutTooltip } from '../../components/ShortcutTooltip'
import { Symbol } from '../../components/Symbol'
import { formatVideoTime } from '../../lib/time'
import { shapeElement } from '../templates/shapeSvg'
import { clamp, formatOffset, scaleShape, type CheckDraft } from './lib'

export interface CheckCardProps {
  draft: CheckDraft
  arena: Shape | null | undefined
  zones: Zone[]
  onChange: (patch: Partial<CheckDraft>) => void
}

/**
 * One video's Check card: overlay preview with drag-to-nudge, a compact trim bar, and warnings —
 * `designs/Screens.dc.html` §isCheck.
 */
export function CheckCard({ draft, arena, zones, onChange }: CheckCardProps): React.JSX.Element {
  const theme = useTheme()
  const [previewStart, setPreviewStart] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const hasWarning = draft.warnings.length > 0

  const handleNudgeStart = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const box = overlayRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const pxPerScreenX = draft.width / rect.width
    const pxPerScreenY = draft.height / rect.height
    const startClientX = event.clientX
    const startClientY = event.clientY
    const startOffsetX = draft.offsetX
    const startOffsetY = draft.offsetY

    const onMove = (moveEvent: PointerEvent): void => {
      const dx = (moveEvent.clientX - startClientX) * pxPerScreenX
      const dy = (moveEvent.clientY - startClientY) * pxPerScreenY
      onChange({ offsetX: startOffsetX + dx, offsetY: startOffsetY + dy })
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: hasWarning ? 'warning.main' : 'divider',
        borderRadius: '10px',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        opacity: draft.included ? 1 : 0.5
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 1 }}>
        <Checkbox
          size="small"
          sx={{ p: 0 }}
          checked={draft.included}
          onChange={(event) => onChange({ included: event.target.checked })}
        />
        <Typography sx={{ fontWeight: 500, flex: 1 }} noWrap>
          {draft.fileName}
        </Typography>
        {hasWarning ? <Symbol name="warning" size={17} sx={{ color: 'warning.main' }} /> : null}
      </Box>

      <Box
        ref={overlayRef}
        onPointerDown={handleNudgeStart}
        title="Drag to nudge the overlay"
        sx={{
          position: 'relative',
          aspectRatio: `${draft.width} / ${draft.height}`,
          bgcolor: 'canvas',
          overflow: 'hidden',
          cursor: 'move'
        }}
      >
        <Box
          component="img"
          src={thumbnailUrl(draft.videoId, {
            maxSide: 420,
            t: previewStart ? draft.trialStart : undefined
          })}
          alt=""
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          draggable={false}
        />
        <svg
          viewBox={`0 0 ${draft.width} ${draft.height}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <g transform={`translate(${draft.offsetX} ${draft.offsetY})`}>
            {arena
              ? shapeElement(scaleShape(arena, draft.scaleX, draft.scaleY), {
                  fill: 'none',
                  stroke: 'white',
                  strokeWidth: 3,
                  strokeDasharray: '14 9',
                  strokeOpacity: 0.9
                })
              : null}
            {zones.map((zone) => {
              const scaled = scaleShape(zone.shape, draft.scaleX, draft.scaleY)
              const color = theme.palette.zones[zone.color_index % theme.palette.zones.length]
              return (
                <g key={zone.id}>
                  {shapeElement(scaled, { fill: color, fillOpacity: 0.14, stroke: color, strokeWidth: 4 })}
                </g>
              )
            })}
          </g>
        </svg>
        <Box
          sx={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.875,
            py: '2px',
            borderRadius: '5px',
            bgcolor: 'surface.dim',
            color: 'common.white',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11
          }}
        >
          <Symbol name="open_with" size={13} />
          {formatOffset(draft.offsetX, draft.offsetY)}
        </Box>
      </Box>

      {hasWarning ? (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            px: 1.25,
            py: 0.875,
            bgcolor: (theme) => `${theme.palette.warning.main}26`,
            fontSize: 11.5,
            textWrap: 'pretty'
          }}
        >
          <Symbol name="warning" size={15} sx={{ color: 'warning.main', flexShrink: 0 }} />
          <span>{draft.warnings.join(' ')}</span>
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 1.125 }}>
        <ShortcutTooltip title="Preview at trial start" shortcut="space">
          <IconButton
            onClick={() => setPreviewStart((prev) => !prev)}
            sx={{
              width: 26,
              height: 26,
              bgcolor: previewStart ? 'primary.main' : 'surface.raised',
              color: previewStart ? 'primary.contrastText' : 'text.primary',
              '&:hover': { bgcolor: previewStart ? 'primary.main' : 'surface.hover' }
            }}
          >
            <Symbol name={previewStart ? 'pause' : 'play_arrow'} size={17} fill />
          </IconButton>
        </ShortcutTooltip>
        <TrimBar
          durationS={draft.durationS}
          start={draft.trialStart}
          end={draft.trialEnd}
          onChange={(start, end) => onChange({ trialStart: start, trialEnd: end })}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.25, pb: 1.25 }}>
        <Typography variant="mono" color="text.secondary" sx={{ fontSize: 11 }}>
          Start {formatVideoTime(draft.trialStart)}
        </Typography>
        <Typography variant="mono" color="text.disabled" sx={{ fontSize: 11 }}>
          →
        </Typography>
        <Typography variant="mono" color="text.secondary" sx={{ fontSize: 11 }}>
          End {formatVideoTime(draft.trialEnd)}
        </Typography>
      </Box>
    </Box>
  )
}

interface TrimBarProps {
  durationS: number
  start: number
  end: number
  onChange: (start: number, end: number) => void
}

const MIN_TRIAL_S = 1

function TrimBar({ durationS, start, end, onChange }: TrimBarProps): React.JSX.Element {
  const barRef = useRef<HTMLDivElement>(null)

  const dragHandle = (which: 'start' | 'end') => (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.stopPropagation()
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()

    const onMove = (moveEvent: PointerEvent): void => {
      const fraction = clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1)
      const t = fraction * durationS
      if (which === 'start') onChange(clamp(t, 0, end - MIN_TRIAL_S), end)
      else onChange(start, clamp(t, start + MIN_TRIAL_S, durationS))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startPct = durationS > 0 ? (start / durationS) * 100 : 0
  const endPct = durationS > 0 ? (end / durationS) * 100 : 100

  return (
    <Box
      ref={barRef}
      sx={{
        position: 'relative',
        flex: 1,
        height: 18,
        borderRadius: '3px',
        bgcolor: 'surface.raised'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${startPct}%`,
          width: `${Math.max(0, endPct - startPct)}%`,
          bgcolor: (theme) => `${theme.palette.primary.main}22`,
          borderLeft: '2px solid',
          borderRight: '2px solid',
          borderColor: 'primary.main',
          boxSizing: 'border-box'
        }}
      />
      <Box
        onPointerDown={dragHandle('start')}
        sx={{
          position: 'absolute',
          top: -2,
          bottom: -2,
          left: `calc(${startPct}% - 4px)`,
          width: 8,
          cursor: 'ew-resize'
        }}
      />
      <Box
        onPointerDown={dragHandle('end')}
        sx={{
          position: 'absolute',
          top: -2,
          bottom: -2,
          left: `calc(${endPct}% - 4px)`,
          width: 8,
          cursor: 'ew-resize'
        }}
      />
    </Box>
  )
}
