import Box from '@mui/material/Box'
import Slider from '@mui/material/Slider'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'

import type { SetupEditor } from '../data'
import { useFlags } from '../data'
import type { Setup, UnusualSizeRule } from '../../../api/types'
import { InfoTip, SectionHeader } from './SectionHeader'

export interface ReviewFlagsSectionProps {
  videoId: string
  setup: Setup
  editor: SetupEditor
}

const DEFAULT_RULE: UnusualSizeRule = {
  enabled: true,
  smaller_than: 0.4,
  larger_than: 2.5,
  min_duration_s: 0
}

interface RuleSliderProps {
  label: string
  info: string
  value: string
  disabled: boolean
  min: number
  max: number
  step: number
  current: number
  onChange: (value: number) => void
}

function RuleSlider({
  label,
  info,
  value,
  disabled,
  min,
  max,
  step,
  current,
  onChange
}: RuleSliderProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 13, color: disabled ? 'text.disabled' : 'text.primary' }}>
            {label}
          </Typography>
          <InfoTip label={label} text={info} />
        </Box>
        <Typography variant="mono" sx={{ fontSize: 12, color: 'text.secondary' }}>
          {value}
        </Typography>
      </Box>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        onChange={(_, next) => onChange(next)}
      />
    </Box>
  )
}

/** When a run of frames is flagged for review as an unusual size. Stored in the analysis settings,
 * so edits re-derive the flags from the existing track — no re-tracking. */
export function ReviewFlagsSection({
  videoId,
  setup,
  editor
}: ReviewFlagsSectionProps): React.JSX.Element {
  const rule = setup.analysis?.unusual_size ?? DEFAULT_RULE
  const flags = useFlags(videoId)
  const sizeFlagCount = flags.data?.filter((flag) => flag.reason === 'unusual_size').length

  const setRule = (patch: Partial<UnusualSizeRule>): void => {
    editor.commitDebounced(
      {
        ...setup,
        analysis: {
          ...setup.analysis,
          in_zone_threshold: setup.analysis?.in_zone_threshold ?? 0.5,
          unusual_size: { ...rule, ...patch }
        }
      },
      'Edit flag rules'
    )
  }

  const off = !rule.enabled
  return (
    <Box>
      <SectionHeader
        title="Review flags"
        info="Choose which frames Tramus marks for you to check after tracking. Changes apply straight away; there is no need to track again."
        sx={{ pb: 1 }}
      />
      <Box sx={{ px: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Switch
            size="small"
            checked={rule.enabled}
            onChange={(_, checked) => setRule({ enabled: checked })}
            slotProps={{ input: { 'aria-label': 'Flag unusual size' } }}
          />
          <Typography sx={{ fontSize: 13 }}>Flag unusual size</Typography>
          <InfoTip
            label="Flag unusual size"
            text="Marks stretches where the mouse looks much smaller or larger than usual. This often means it is partly hidden or two shapes merged."
          />
        </Box>
        <RuleSlider
          label="Smaller than"
          info="Flag frames where the mouse is smaller than this share of its typical size. Lower it to see fewer flags."
          value={`${rule.smaller_than.toFixed(2)}×`}
          disabled={off}
          min={0.1}
          max={0.9}
          step={0.05}
          current={rule.smaller_than}
          onChange={(smaller_than) => setRule({ smaller_than })}
        />
        <RuleSlider
          label="Larger than"
          info="Flag frames where the mouse is larger than this many times its typical size. Raise it to see fewer flags."
          value={`${rule.larger_than.toFixed(2)}×`}
          disabled={off}
          min={1.1}
          max={5}
          step={0.1}
          current={rule.larger_than}
          onChange={(larger_than) => setRule({ larger_than })}
        />
        <RuleSlider
          label="Ignore shorter than"
          info="Skip flags that last less than this many seconds. Raise it to hide brief blips."
          value={`${rule.min_duration_s.toFixed(1)} s`}
          disabled={off}
          min={0}
          max={2}
          step={0.1}
          current={rule.min_duration_s}
          onChange={(min_duration_s) => setRule({ min_duration_s })}
        />
        {sizeFlagCount != null && rule.enabled ? (
          <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
            {sizeFlagCount} unusual-size {sizeFlagCount === 1 ? 'flag' : 'flags'} with these rules
          </Typography>
        ) : null}
      </Box>
    </Box>
  )
}
