import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'

import type { SetupEditor } from '../data'
import type { DetectionSettings, Setup } from '../../../api/types'
import {
  mmPerPxOf,
  pxAreaToUnit,
  roundForAreaUnit,
  unitAreaToPx,
  type ZoneUnit
} from '../lib/units'
import { useWorkspaceStore } from '../state/workspaceStore'
import { UnitToggle } from './UnitToggle'

export interface DetectionSectionProps {
  setup: Setup
  editor: SetupEditor
}

const DEFAULT_DETECTION: DetectionSettings = {
  tracker: 'background_subtraction',
  sensitivity: 60,
  polarity: 'darker',
  min_mouse_area_px: 300
}
const DEFAULT_THRESHOLD = 0.5

/** Slider bounds per display unit — independent constants (not a literal px↔cm conversion of one
 * another) so each unit's range and step feel like round, natural numbers to type/drag. */
const AREA_SLIDER: Record<ZoneUnit, { min: number; max: number; step: number }> = {
  px: { min: 20, max: 800, step: 10 },
  cm: { min: 0.1, max: 8, step: 0.05 }
}

/** Sensitivity, polarity, minimum size, in-zone threshold (design: `Detection` section). */
export function DetectionSection({ setup, editor }: DetectionSectionProps): React.JSX.Element {
  const detection = setup.detection ?? DEFAULT_DETECTION
  const thresholdFraction = setup.analysis?.in_zone_threshold ?? DEFAULT_THRESHOLD
  const thresholdPercent = Math.round(thresholdFraction * 100)
  const mmPerPx = mmPerPxOf(setup.calibration)

  const [storedAreaUnit, setAreaUnit] = useState<ZoneUnit>(mmPerPx != null ? 'cm' : 'px')
  // Same fallback pattern as `SelectedZonePanel`: derived, not synced, so removing the scale can't
  // leave a stale 'cm' selection with nothing to convert.
  const areaUnit: ZoneUnit = mmPerPx == null ? 'px' : storedAreaUnit
  const areaRange = AREA_SLIDER[areaUnit]

  const setSizePreviewPx = useWorkspaceStore((s) => s.setSizePreviewPx)
  const [previewActive, setPreviewActive] = useState(false)
  useEffect(() => {
    if (!previewActive) return undefined
    setSizePreviewPx(detection.min_mouse_area_px)
    return () => setSizePreviewPx(null)
  }, [previewActive, detection.min_mouse_area_px, setSizePreviewPx])

  const setDetection = (
    patch: Partial<DetectionSettings>,
    label: string,
    debounced = true
  ): void => {
    const next = { ...setup, detection: { ...detection, ...patch } }
    if (debounced) editor.commitDebounced(next, label)
    else void editor.commit(next, label)
  }

  const setThreshold = (percent: number): void => {
    editor.commitDebounced(
      { ...setup, analysis: { in_zone_threshold: percent / 100 } },
      'Adjust in-zone threshold'
    )
  }

  const areaDisplayValue = roundForAreaUnit(
    pxAreaToUnit(detection.min_mouse_area_px, areaUnit, mmPerPx),
    areaUnit
  )
  const setMinArea = (displayValue: number): void => {
    const px = Math.round(unitAreaToPx(displayValue, areaUnit, mmPerPx))
    setDetection({ min_mouse_area_px: px }, 'Adjust minimum mouse size')
  }

  return (
    <Box>
      <Box sx={{ px: 1.75, pt: 1.75, pb: 1 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          Detection
        </Typography>
      </Box>
      <Box sx={{ px: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13 }}>Sensitivity</Typography>
            <Typography variant="mono" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {detection.sensitivity}
            </Typography>
          </Box>
          <Slider
            min={0}
            max={100}
            value={detection.sensitivity}
            onChange={(_, value) => setDetection({ sensitivity: value }, 'Adjust sensitivity')}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625 }}>
          <Typography sx={{ fontSize: 13 }}>Mouse is</Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2px',
              p: 0.375,
              borderRadius: '8px',
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider'
            }}
          >
            {(['darker', 'lighter'] as const).map((polarity) => (
              <ButtonBase
                key={polarity}
                onClick={() => setDetection({ polarity }, 'Change detection polarity', false)}
                sx={{
                  height: 26,
                  borderRadius: '5px',
                  fontSize: 12,
                  fontWeight: 500,
                  bgcolor: detection.polarity === polarity ? 'surface.raised' : 'transparent',
                  color: detection.polarity === polarity ? 'text.primary' : 'text.secondary'
                }}
              >
                {polarity === 'darker' ? 'Darker than floor' : 'Lighter than floor'}
              </ButtonBase>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13 }}>Minimum mouse size</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="mono" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {areaDisplayValue} {areaUnit}²
              </Typography>
              <UnitToggle unit={areaUnit} onChange={setAreaUnit} disabledCm={mmPerPx == null} />
            </Box>
          </Box>
          <Slider
            min={areaRange.min}
            max={areaRange.max}
            step={areaRange.step}
            value={areaDisplayValue}
            onChange={(_, value) => setMinArea(value)}
            onMouseEnter={() => setPreviewActive(true)}
            onMouseLeave={() => setPreviewActive(false)}
            onFocus={() => setPreviewActive(true)}
            onBlur={() => setPreviewActive(false)}
            onPointerUp={() => setPreviewActive(false)}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13 }}>In-zone threshold</Typography>
            <Typography variant="mono" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {thresholdPercent}%
            </Typography>
          </Box>
          <Slider
            min={10}
            max={90}
            step={5}
            value={thresholdPercent}
            onChange={(_, value) => setThreshold(value)}
          />
          <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
            Share of the body that must be inside a zone before the mouse counts as in it.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
