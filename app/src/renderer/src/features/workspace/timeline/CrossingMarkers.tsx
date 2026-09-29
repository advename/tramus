import Box from '@mui/material/Box'

import type { CrossingEvent } from '../../../api/types'
import { formatVideoTime } from '../../../lib/time'
import { percentOfDuration } from '../lib/timelineScale'

export interface CrossingMarkersProps {
  /** The selected rule's matching events (`docs/architecture.md` §5.7); empty renders nothing. */
  events: readonly CrossingEvent[]
  durationS: number
  color: string
}

/**
 * Small diamond markers over the tracks area for the selected crossing rule's events — an
 * overlay (not its own lane), so it needs no change to `laneRowHeight`/label-column bookkeeping.
 * Rendered by `TimelineTracks` alongside the playhead.
 */
export function CrossingMarkers({
  events,
  durationS,
  color
}: CrossingMarkersProps): React.JSX.Element {
  return (
    <>
      {events.map((event, i) => (
        <Box
          key={`${event.frame}-${i}`}
          title={`${formatVideoTime(event.time_s)} · crossing`}
          sx={{
            position: 'absolute',
            left: percentOfDuration(event.time_s, durationS),
            top: 20,
            bottom: 0,
            width: 0,
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              left: -3,
              width: 6,
              height: 6,
              ml: '-0.5px',
              transform: 'rotate(45deg)',
              bgcolor: color
            }}
          />
        </Box>
      ))}
    </>
  )
}
