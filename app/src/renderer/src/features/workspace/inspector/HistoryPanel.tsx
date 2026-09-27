import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import type { HistoryEntry } from '../../../api/types'
import { Symbol } from '../../../components/Symbol'
import { historyIcon } from '../lib/history'

export interface HistoryPanelProps {
  entries: HistoryEntry[]
  onSelect: (entry: HistoryEntry) => void
}

/** Review › History tab (design: `showHistory`, `histRows`). */
export function HistoryPanel({ entries, onSelect }: HistoryPanelProps): React.JSX.Element {
  return (
    <Box>
      <Box sx={{ px: 1.75, pt: 1.5, pb: 0.75 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          Edit history
        </Typography>
      </Box>
      {entries.length === 0 ? (
        <Typography sx={{ px: 1.75, pb: 1.5, fontSize: 12, color: 'text.disabled' }}>
          No edits yet.
        </Typography>
      ) : (
        entries.map((entry) => (
          <Box
            key={entry.id}
            onClick={() => onSelect(entry)}
            sx={{
              display: 'grid',
              gridTemplateColumns: '26px minmax(0,1fr) auto',
              gap: 1.25,
              px: 1.75,
              py: 1,
              alignItems: 'start',
              cursor: entry.t_start_s != null ? 'pointer' : 'default',
              '&:hover': entry.t_start_s != null ? { bgcolor: 'surface.hover' } : undefined
            }}
          >
            <Box
              component="span"
              sx={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                bgcolor: 'surface.raised',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <Symbol name={historyIcon(entry.kind)} size={15} sx={{ color: 'text.secondary' }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500, fontSize: 13 }}>{entry.title}</Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>{entry.detail}</Typography>
            </Box>
            <Typography
              variant="mono"
              sx={{ fontSize: 11, color: 'text.disabled', whiteSpace: 'nowrap' }}
            >
              {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
                new Date(entry.at)
              )}
            </Typography>
          </Box>
        ))
      )}
      <Typography sx={{ mx: 1.75, mb: 2, mt: 0.5, fontSize: 11.5, color: 'text.disabled' }}>
        Every correction is saved in the analysis file and exported with the results as a separate
        sheet.
      </Typography>
    </Box>
  )
}
