import Box from '@mui/material/Box'

import type { Exclusion } from '../../../api/types'
import { formatDuration, formatVideoTime } from '../../../lib/time'
import { percentOfDuration, widthOfDuration } from '../lib/timelineScale'

export interface ExclusionBandsProps {
  exclusions: readonly Exclusion[]
  durationS: number
  selectedExclusionId: string | null
  /** Whether edge handles are shown (locked, e.g. while tracking — same idea as the Setup
   * inspector's "Excluded periods" section going opaque/inert). Selecting and hovering still work. */
  editable: boolean
  onSelect: (exclusionId: string) => void
}

/**
 * One hatched band per `Setup.exclusion`, spanning every lane — diagonal stripes in
 * `surface.dim`/`divider` tones, visually distinct from the solid before/after-trial dimming
 * (`TimelineTracks`' "Trial dimming" blocks use a flat `surface.dim` fill). Clicking a band
 * selects it (outline highlight); its edges are `data-drag="exclusion-start"|"exclusion-end"`
 * handles that `useTimelineDrag` picks up by delegation from the tracks container, tagged with
 * `data-exclusion-id` so the drag knows which one moved.
 */
export function ExclusionBands({
  exclusions,
  durationS,
  selectedExclusionId,
  editable,
  onSelect
}: ExclusionBandsProps): React.JSX.Element {
  const pct = (t: number): string => percentOfDuration(t, durationS)
  const widthPct = (deltaS: number): string => widthOfDuration(deltaS, durationS)

  return (
    <>
      {exclusions.map((exclusion) => {
        const selected = exclusion.id === selectedExclusionId
        const label = `${formatVideoTime(exclusion.start_s)}–${formatVideoTime(exclusion.end_s)} · ${formatDuration(exclusion.end_s - exclusion.start_s)} excluded${exclusion.note ? ` · ${exclusion.note}` : ''}`
        return (
          <Box
            key={exclusion.id}
            title={label}
            onClick={() => onSelect(exclusion.id)}
            sx={{
              position: 'absolute',
              left: pct(exclusion.start_s),
              width: widthPct(Math.max(0, exclusion.end_s - exclusion.start_s)),
              top: 20,
              bottom: 0,
              cursor: 'pointer',
              backgroundImage: (theme) =>
                `repeating-linear-gradient(45deg, ${theme.palette.surface.dim} 0px 5px, ${theme.palette.divider} 5px 10px)`,
              outline: selected ? '2px solid' : 'none',
              outlineColor: selected ? 'primary.main' : undefined,
              outlineOffset: '-1px',
              zIndex: 1
            }}
          >
            {editable && (
              <>
                <ExclusionEdgeHandle exclusionId={exclusion.id} side="start" />
                <ExclusionEdgeHandle exclusionId={exclusion.id} side="end" />
              </>
            )}
          </Box>
        )
      })}
    </>
  )
}

function ExclusionEdgeHandle({
  exclusionId,
  side
}: {
  exclusionId: string
  side: 'start' | 'end'
}): React.JSX.Element {
  const isStart = side === 'start'
  return (
    <Box
      data-drag={`exclusion-${side}`}
      data-exclusion-id={exclusionId}
      title={isStart ? 'Drag to change the start' : 'Drag to change the end'}
      sx={{
        position: 'absolute',
        [isStart ? 'left' : 'right']: 0,
        top: 0,
        bottom: 0,
        width: 6,
        ml: isStart ? '-3px' : 0,
        mr: isStart ? 0 : '-3px',
        cursor: 'ew-resize'
      }}
    />
  )
}
