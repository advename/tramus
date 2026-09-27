import { BarChart } from '@mui/x-charts/BarChart'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import type { Results } from '../../../api/types'

export interface SummaryChartProps {
  results: Results
}

/** "Time in zone (s)" horizontal bar chart, one bar per summary row, zone-coloured. */
export function SummaryChart({ results }: SummaryChartProps): React.JSX.Element {
  const theme = useTheme()
  const names = results.summary.map((row) => row.name)
  const values = results.summary.map((row) => Number(row.time_s.toFixed(1)))
  const colors = results.summary.map((row) =>
    row.color_index != null
      ? (theme.palette.zones[row.color_index] ?? theme.palette.text.disabled)
      : theme.palette.divider
  )

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25
      }}
    >
      <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>Time in zone (s)</Typography>
      <BarChart
        height={Math.max(120, names.length * 34 + 40)}
        layout="horizontal"
        series={[{ data: values, label: 'Time in zone' }]}
        yAxis={[
          {
            scaleType: 'band',
            data: names,
            colorMap: { type: 'ordinal', values: names, colors },
            tickLabelStyle: { fontSize: 12 },
            width: 112
          }
        ]}
        xAxis={[{ tickLabelStyle: { fontSize: 10, fontFamily: '"IBM Plex Mono", monospace' } }]}
        hideLegend
        grid={{ vertical: true }}
      />
    </Box>
  )
}
