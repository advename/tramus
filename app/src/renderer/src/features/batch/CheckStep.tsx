import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import type { Shape, Zone } from '../../api/types'
import { Symbol } from '../../components/Symbol'
import { formatShortDuration } from '../../lib/time'
import { CheckCard } from './CheckCard'
import type { CheckDraft } from './lib'

export interface CheckStepProps {
  drafts: CheckDraft[]
  onChangeDraft: (videoId: string, patch: Partial<CheckDraft>) => void
  arena: Shape | null | undefined
  zones: Zone[]
  trialDurationS: number | null
}

/** Batch step 2: one card per video, overlay + trim + warnings — `designs/Screens.dc.html` §isCheck. */
export function CheckStep({
  drafts,
  onChangeDraft,
  arena,
  zones,
  trialDurationS
}: CheckStepProps): React.JSX.Element {
  const includedCount = drafts.filter((d) => d.included).length

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
          flex: 'none'
        }}
      >
        <Typography color="text.secondary" sx={{ textWrap: 'pretty', flex: 1, minWidth: 240 }}>
          Check each video before tracking. Drag the overlay to nudge it if the camera moved, and
          set when each trial starts.
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {includedCount} of {drafts.length} included
        </Typography>
        {trialDurationS != null ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              height: 28,
              px: 1.25,
              border: 1,
              borderColor: 'surface.lineStrong',
              borderRadius: '6px',
              fontSize: 12.5,
              whiteSpace: 'nowrap'
            }}
          >
            <Symbol name="lock" size={16} />
            Trial length {formatShortDuration(trialDurationS)}
          </Box>
        ) : null}
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          p: 2,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 1.75,
          alignContent: 'start'
        }}
      >
        {drafts.map((draft) => (
          <CheckCard
            key={draft.videoId}
            draft={draft}
            arena={arena}
            zones={zones}
            onChange={(patch) => onChangeDraft(draft.videoId, patch)}
          />
        ))}
      </Box>
    </>
  )
}
