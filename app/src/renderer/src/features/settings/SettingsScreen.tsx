import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

import { useSettings, useSystemInfo, useUpdateSettings } from '../../api/queries'
import type { AppSettings } from '../../api/types'
import { Symbol } from '../../components/Symbol'
import { notifyError } from '../../stores/notifications'

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16]
const TRAIL_LENGTHS_S = [5, 10, 15, 20, 25, 30]
const IN_ZONE_THRESHOLDS = [0.25, 0.5, 0.6, 0.75, 0.9]
const MIN_PARALLEL_JOBS = 1
const MAX_PARALLEL_JOBS = 16

/**
 * The Settings screen (`designs/Screens.dc.html` §settings): Processing, Defaults for new
 * analyses, Appearance. Every control saves immediately via `useUpdateSettings`.
 */
export function SettingsScreen(): React.JSX.Element {
  const { data: settings } = useSettings()
  const { data: system } = useSystemInfo()
  const updateSettings = useUpdateSettings()

  const save = (patch: Partial<AppSettings>): void => {
    updateSettings.mutate(patch, {
      onError: (error) => notifyError('Could not save settings', error)
    })
  }

  const gpuName = system?.gpu?.name
  const deviceHelp = gpuName
    ? `Auto uses the GPU when one is available. Found: ${gpuName}.`
    : 'No compatible GPU found — tracking runs on the CPU.'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          height: 60,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flex: 'none'
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Settings</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, px: 2, pt: 2.5, pb: 4 }}>
        <Box sx={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 2.75 }}>
          <SettingsGroup title="Processing">
            <SettingsRow label="Run tracking on" help={deviceHelp}>
              <SegmentedControl
                value={settings?.device ?? 'auto'}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'cpu', label: 'CPU' },
                  { value: 'gpu', label: 'GPU' }
                ]}
                onChange={(value) => save({ device: value })}
              />
            </SettingsRow>
            <SettingsRow
              label="Videos processed in parallel"
              help="Used by Batch. More is faster but uses more memory. Applies after restarting Tramus."
            >
              <Stepper
                value={settings?.parallel_jobs ?? 2}
                min={MIN_PARALLEL_JOBS}
                max={MAX_PARALLEL_JOBS}
                onChange={(value) => save({ parallel_jobs: value })}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Defaults for new analyses">
            <SettingsRow
              label="Playback speed in Review"
              help="Speed used when a video opens in Review."
            >
              <Select
                size="small"
                value={settings?.review_playback_speed ?? 4}
                onChange={(event) => save({ review_playback_speed: Number(event.target.value) })}
                sx={{ minWidth: 90, fontFamily: '"IBM Plex Mono", monospace', fontSize: 12.5 }}
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <MenuItem
                    key={speed}
                    value={speed}
                    sx={{ fontFamily: '"IBM Plex Mono", monospace' }}
                  >
                    {speed}×
                  </MenuItem>
                ))}
              </Select>
            </SettingsRow>
            <SettingsRow
              label="Trail length"
              help="How much recent movement the red trail and heatmap show."
            >
              <Select
                size="small"
                value={settings?.trail_length_s ?? 10}
                onChange={(event) => save({ trail_length_s: Number(event.target.value) })}
                sx={{ minWidth: 90, fontFamily: '"IBM Plex Mono", monospace', fontSize: 12.5 }}
              >
                {TRAIL_LENGTHS_S.map((seconds) => (
                  <MenuItem
                    key={seconds}
                    value={seconds}
                    sx={{ fontFamily: '"IBM Plex Mono", monospace' }}
                  >
                    {seconds} s
                  </MenuItem>
                ))}
              </Select>
            </SettingsRow>
            <SettingsRow
              label="In-zone threshold"
              help="Share of the body that must be inside a zone to count as in it."
            >
              <Select
                size="small"
                value={settings?.default_in_zone_threshold ?? 0.5}
                onChange={(event) =>
                  save({ default_in_zone_threshold: Number(event.target.value) })
                }
                sx={{ minWidth: 90, fontFamily: '"IBM Plex Mono", monospace', fontSize: 12.5 }}
              >
                {IN_ZONE_THRESHOLDS.map((threshold) => (
                  <MenuItem
                    key={threshold}
                    value={threshold}
                    sx={{ fontFamily: '"IBM Plex Mono", monospace' }}
                  >
                    {Math.round(threshold * 100)}%
                  </MenuItem>
                ))}
              </Select>
            </SettingsRow>
            <SettingsRow
              label="Export layout"
              help="Default offered by the export dialog: wide is one row per video, long is one row per video and zone."
            >
              <SegmentedControl
                value={settings?.export_layout ?? 'wide'}
                options={[
                  { value: 'wide', label: 'Wide' },
                  { value: 'long', label: 'Long' }
                ]}
                onChange={(value) => save({ export_layout: value })}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Appearance">
            <SettingsRow label="Theme" help="System follows your operating system setting.">
              <SegmentedControl
                value={settings?.theme ?? 'dark'}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                  { value: 'system', label: 'System' }
                ]}
                onChange={(value) => save({ theme: value })}
              />
            </SettingsRow>
          </SettingsGroup>
        </Box>
      </Box>
    </Box>
  )
}

interface SettingsGroupProps {
  title: string
  children: ReactNode
}

function SettingsGroup({ title, children }: SettingsGroupProps): React.JSX.Element {
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

interface SettingsRowProps {
  label: string
  help: string
  children: ReactNode
}

function SettingsRow({ label, help, children }: SettingsRowProps): React.JSX.Element {
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

interface SegmentedControlProps<T extends string> {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_event, next: T | null) => {
        if (next !== null) onChange(next)
      }}
      sx={{
        p: 0.375,
        border: 1,
        borderColor: 'divider',
        borderRadius: '8px',
        bgcolor: 'background.default',
        gap: 0.25
      }}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          value={option.value}
          sx={{
            height: 28,
            px: 1.75,
            border: 'none',
            borderRadius: '6px !important',
            fontSize: 12.5,
            fontWeight: 500,
            textTransform: 'none',
            color: 'text.secondary',
            '&.Mui-selected': { bgcolor: 'surface.raised', color: 'text.primary' },
            '&.Mui-selected:hover': { bgcolor: 'surface.raised' }
          }}
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

interface StepperProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

function Stepper({ value, min, max, onChange }: StepperProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: '7px',
        overflow: 'hidden'
      }}
    >
      <IconButton
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        sx={{ width: 32, height: 30, borderRadius: 0 }}
      >
        <Symbol name="remove" size={17} />
      </IconButton>
      <Typography
        variant="mono"
        sx={{
          width: 40,
          textAlign: 'center',
          borderLeft: 1,
          borderRight: 1,
          borderColor: 'surface.lineStrong'
        }}
      >
        {value}
      </Typography>
      <IconButton
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        sx={{ width: 32, height: 30, borderRadius: 0 }}
      >
        <Symbol name="add" size={17} />
      </IconButton>
    </Box>
  )
}
