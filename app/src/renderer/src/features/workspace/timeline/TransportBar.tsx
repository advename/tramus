import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'

import { Kbd } from '../../../components/Kbd'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'
import { TimeText } from '../../../components/TimeText'
import { formatDuration } from '../../../lib/time'
import { TIMELINE_ZOOM_MAX, TIMELINE_ZOOM_MIN } from '../state/workspaceStore'

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16]

export interface TransportBarProps {
  playing: boolean
  onTogglePlay: () => void
  onStepFrame: (delta: number) => void
  speed: number
  onSpeedChange: (speed: number) => void
  timeS: number
  durationS: number
  clockLabel: string | null
  onSetStartHere: () => void
  onSetEndHere: () => void
  startS: number
  endS: number
  locked: boolean
  onToggleLock: () => void
  zoom: number
  onZoomChange: (zoom: number) => void
}

/** The timeline's transport row: playback controls, time readout, trial start/end, zoom. */
export function TransportBar({
  playing,
  onTogglePlay,
  onStepFrame,
  speed,
  onSpeedChange,
  timeS,
  durationS,
  clockLabel,
  onSetStartHere,
  onSetEndHere,
  startS,
  endS,
  locked,
  onToggleLock,
  zoom,
  onZoomChange
}: TransportBarProps): React.JSX.Element {
  const [speedAnchor, setSpeedAnchor] = useState<HTMLElement | null>(null)

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px 18px',
        px: 1.5,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <ShortcutTooltip title="Previous frame" shortcut="left">
          <IconButton onClick={() => onStepFrame(-1)} sx={{ width: 28, height: 28, color: 'text.secondary' }}>
            <Symbol name="navigate_before" size={20} />
          </IconButton>
        </ShortcutTooltip>
        <ShortcutTooltip title="Play / pause" shortcut="space">
          <IconButton
            onClick={onTogglePlay}
            sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }}
          >
            <Symbol name={playing ? 'pause' : 'play_arrow'} fill size={22} />
          </IconButton>
        </ShortcutTooltip>
        <ShortcutTooltip title="Next frame" shortcut="right">
          <IconButton onClick={() => onStepFrame(1)} sx={{ width: 28, height: 28, color: 'text.secondary' }}>
            <Symbol name="navigate_next" size={20} />
          </IconButton>
        </ShortcutTooltip>
        <Button
          title="Playback speed 0.25×–16×"
          onClick={(e) => setSpeedAnchor(e.currentTarget)}
          endIcon={<Symbol name="expand_more" size={16} />}
          sx={{ height: 26, ml: 0.75, px: 1, border: 1, borderColor: 'surface.lineStrong', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}
        >
          {speed}×
        </Button>
        <Menu anchorEl={speedAnchor} open={Boolean(speedAnchor)} onClose={() => setSpeedAnchor(null)}>
          {SPEEDS.map((s) => (
            <MenuItem
              key={s}
              selected={s === speed}
              onClick={() => {
                onSpeedChange(s)
                setSpeedAnchor(null)
              }}
            >
              {s}×
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Box title={clockLabel ? `Local clock time ${clockLabel}` : undefined} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}>
        <TimeText seconds={timeS} sx={{ fontSize: 16, fontWeight: 500 }} />
        <Typography variant="mono" component="span" sx={{ fontSize: 11.5, color: 'text.disabled' }}>
          / {formatDuration(durationS)}
        </Typography>
        {clockLabel && (
          <Typography variant="mono" component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
            {clockLabel}
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Typography variant="overline" sx={{ color: 'text.disabled', mr: 0.25 }}>
          Trial
        </Typography>
        <Button
          title="Set start at playhead · I"
          onClick={onSetStartHere}
          sx={{ height: 26, px: 0.75, gap: 0.75, border: 1, borderColor: 'surface.lineStrong', color: 'text.primary' }}
        >
          <Symbol name="first_page" size={15} />
          <TimeText seconds={startS} component="span" />
          <Kbd>I</Kbd>
        </Button>
        <Button
          title="Set end at playhead · O"
          onClick={onSetEndHere}
          sx={{ height: 26, px: 0.75, gap: 0.75, border: 1, borderColor: 'surface.lineStrong', color: 'text.primary' }}
        >
          <TimeText seconds={endS} component="span" />
          <Symbol name="last_page" size={15} />
          <Kbd>O</Kbd>
        </Button>
        <TimeText
          seconds={endS - startS}
          format="duration"
          title="Trial duration"
          sx={{ fontSize: 12, color: 'text.secondary', px: 0.25 }}
        />
        <Button
          title="Lock duration — moving the start also moves the end"
          onClick={onToggleLock}
          startIcon={<Symbol name={locked ? 'lock' : 'lock_open'} size={15} />}
          sx={{
            height: 26,
            px: 1,
            border: 1,
            borderColor: locked ? 'primary.main' : 'surface.lineStrong',
            bgcolor: locked ? 'action.selected' : 'transparent',
            color: 'text.primary'
          }}
        >
          {locked ? 'Locked' : 'Lock duration'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <ShortcutTooltip title="Zoom timeline out" shortcut="mod+scroll">
          <IconButton
            onClick={() => onZoomChange(Math.max(TIMELINE_ZOOM_MIN, zoom - 0.5))}
            sx={{ width: 26, height: 26, color: 'text.secondary' }}
          >
            <Symbol name="remove" size={18} />
          </IconButton>
        </ShortcutTooltip>
        <Slider
          value={zoom}
          onChange={(_, v) => onZoomChange(v)}
          min={TIMELINE_ZOOM_MIN}
          max={TIMELINE_ZOOM_MAX}
          step={0.5}
          sx={{ width: 64 }}
        />
        <ShortcutTooltip title="Zoom timeline in" shortcut="mod+scroll">
          <IconButton
            onClick={() => onZoomChange(Math.min(TIMELINE_ZOOM_MAX, zoom + 0.5))}
            sx={{ width: 26, height: 26, color: 'text.secondary' }}
          >
            <Symbol name="add" size={18} />
          </IconButton>
        </ShortcutTooltip>
      </Box>
    </Box>
  )
}
