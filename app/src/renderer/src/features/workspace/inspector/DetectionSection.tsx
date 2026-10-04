import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Divider from '@mui/material/Divider'
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
import { ReviewFlagsSection } from './ReviewFlagsSection'
import { InfoTip, SectionHeader } from './SectionHeader'
import { UnitToggle } from './UnitToggle'

export interface DetectionSectionProps {
  videoId: string
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
export function DetectionSection({
  videoId,
  setup,
  editor
}: DetectionSectionProps): React.JSX.Element {
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
      { ...setup, analysis: { ...setup.analysis, in_zone_threshold: percent / 100 } },
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
      <SectionHeader
        title="Detection"
        info="How Tramus finds the mouse in each frame. Changes apply the next time you track."
        sx={{ pb: 1 }}
      />
      <Box sx={{ px: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 13 }}>Sensitivity</Typography>
              <InfoTip
                label="Sensitivity"
                text="How readily Tramus calls something the mouse. Raise it if the mouse is missed; lower it if shadows or reflections are picked up."
              />
            </Box>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 13 }}>Mouse is</Typography>
            <InfoTip
              label="Mouse is"
              text="Whether the mouse is darker or lighter than the floor. Pick the one that matches your video."
            />
          </Box>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 13 }}>Minimum mouse size</Typography>
              <InfoTip
                label="Minimum mouse size"
                text="Shapes smaller than this are ignored. Raise it to skip specks and droppings; keep it below the mouse's own size."
              />
            </Box>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 13 }}>In-zone threshold</Typography>
              <InfoTip
                label="In-zone threshold"
                text="How much of the mouse's body must be inside a zone to count as in it. 50% means at least half the body."
              />
            </Box>
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
        </Box>
      </Box>
      <Divider sx={{ mt: 1.75 }} />
      <ReviewFlagsSection videoId={videoId} setup={setup} editor={editor} />
    </Box>
  )
}
