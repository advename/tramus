import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { type Theme, useTheme } from '@mui/material/styles'

import type { Results, SummaryRow } from '../../../api/types'
import { formatDuration } from '../../../lib/time'

export interface SummaryTableProps {
  results: Results
}

function rowColor(row: SummaryRow, theme: Theme): string {
  return row.color_index != null
    ? (theme.palette.zones[row.color_index] ?? theme.palette.text.disabled)
    : theme.palette.text.disabled
}

/** Zone / time / % of trial table with a total row (design: the Summary table card). */
export function SummaryTable({ results }: SummaryTableProps): React.JSX.Element {
  const theme = useTheme()

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 110px 80px',
          gap: 1.5,
          px: 2,
          height: 34,
          alignItems: 'center',
          fontSize: 11.5,
          color: 'text.disabled',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <span>Zone</span>
        <span style={{ textAlign: 'right' }}>Time in zone</span>
        <span style={{ textAlign: 'right' }}>% of analysed</span>
      </Box>
      {results.summary.map((row) => (
        <Box
          key={row.zone_id ?? row.kind}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 110px 80px',
            gap: 1.5,
            px: 2,
            height: 40,
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125, minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                width: 12,
                height: 12,
                boxSizing: 'border-box',
                borderRadius: '3px',
                border: `1.5px solid ${rowColor(row, theme)}`,
                bgcolor: `${rowColor(row, theme)}40`,
                flexShrink: 0
              }}
            />
            <Typography
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 13
              }}
            >
              {row.name}
            </Typography>
          </Box>
          <Typography variant="mono" sx={{ textAlign: 'right', fontSize: 12.5 }}>
            {row.time_s.toFixed(3)} s
          </Typography>
          <Typography
            variant="mono"
            sx={{ textAlign: 'right', fontSize: 12.5, color: 'text.secondary' }}
          >
            {(row.share_of_analysed * 100).toFixed(1)} %
          </Typography>
        </Box>
      ))}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 110px 80px',
          gap: 1.5,
          px: 2,
          height: 42,
          alignItems: 'center',
          fontWeight: 600
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Total
          <Typography
            component="span"
            sx={{ fontWeight: 400, fontSize: 11.5, color: 'text.disabled' }}
          >
            = analysed time
          </Typography>
        </Box>
        <Typography variant="mono" sx={{ textAlign: 'right', fontSize: 12.5 }}>
          {formatDuration(results.analysed_duration_s)}
        </Typography>
        <Typography variant="mono" sx={{ textAlign: 'right', fontSize: 12.5 }}>
          100.0 %
        </Typography>
      </Box>
    </Box>
  )
}
