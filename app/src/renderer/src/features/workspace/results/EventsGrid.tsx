import { useMemo, useState } from 'react'
import { DataGrid, type GridColDef, type GridRowParams } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import type { Results, ZoneVisit } from '../../../api/types'
import { formatClockTime, formatVideoTime } from '../../../lib/time'

export interface EventsGridProps {
  results: Results
  recordedAt: string | null
  onRowClick: (visit: ZoneVisit) => void
}

interface EventRow extends ZoneVisit {
  color: string
}

/** Review's zone-visit events grid (design: `isEvents`, `evChips`, `events`). */
export function EventsGrid({ results, recordedAt, onRowClick }: EventsGridProps): React.JSX.Element {
  const theme = useTheme()
  const [zoneFilter, setZoneFilter] = useState<string>('all')

  const zoneColor = useMemo(() => {
    const byId = new Map<string, string>()
    for (const row of results.summary) {
      if (row.zone_id) byId.set(row.zone_id, row.color_index != null ? theme.palette.zones[row.color_index] ?? theme.palette.text.disabled : theme.palette.text.disabled)
    }
    return byId
  }, [results.summary, theme])

  const zoneChips = useMemo(() => {
    const zones = results.summary.filter((row) => row.kind === 'zone')
    return [
      { key: 'all', label: 'All zones', color: theme.palette.text.disabled, count: results.visits.length },
      ...zones.map((row) => ({
        key: row.zone_id!,
        label: row.name,
        color: zoneColor.get(row.zone_id!) ?? theme.palette.text.disabled,
        count: results.visits.filter((v) => v.zone_id === row.zone_id).length
      }))
    ]
  }, [results, zoneColor, theme])

  const rows: EventRow[] = useMemo(
    () =>
      results.visits
        .filter((visit) => zoneFilter === 'all' || visit.zone_id === zoneFilter)
        .map((visit) => ({ ...visit, color: zoneColor.get(visit.zone_id) ?? theme.palette.text.disabled })),
    [results.visits, zoneFilter, zoneColor, theme]
  )

  const columns: GridColDef<EventRow>[] = [
    { field: 'index', headerName: '#', width: 56, type: 'number' },
    {
      field: 'zone_name',
      headerName: 'Zone',
      flex: 1.3,
      minWidth: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, height: '100%' }}>
          <Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: params.row.color, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {params.row.zone_name}
          </span>
        </Box>
      )
    },
    {
      field: 'enter_s',
      headerName: 'Entered',
      flex: 1,
      minWidth: 110,
      renderCell: (params) => <TwoLineTime seconds={params.row.enter_s} recordedAt={recordedAt} />
    },
    {
      field: 'exit_s',
      headerName: 'Left',
      flex: 1,
      minWidth: 110,
      renderCell: (params) => <TwoLineTime seconds={params.row.exit_s} recordedAt={recordedAt} />
    },
    {
      field: 'duration_s',
      headerName: 'Duration',
      width: 92,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: number) => `${value.toFixed(3)} s`
    }
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', mr: 0.5 }}>Filter</Typography>
        {zoneChips.map((chip) => (
          <ButtonBase
            key={chip.key}
            onClick={() => setZoneFilter(chip.key)}
            sx={{
              height: 26,
              px: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              borderRadius: '13px',
              border: '1px solid',
              borderColor: zoneFilter === chip.key ? 'primary.main' : 'surface.lineStrong',
              bgcolor: zoneFilter === chip.key ? alpha(theme.palette.primary.main, 0.13) : 'transparent',
              fontSize: 12
            }}
          >
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: chip.color }} />
            {chip.label}
            <Typography variant="mono" component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>
              {chip.count}
            </Typography>
          </ButtonBase>
        ))}
      </Box>

      <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '10px', overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.index}
          autoHeight
          disableColumnMenu
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
          onRowClick={(params: GridRowParams<EventRow>) => onRowClick(params.row)}
          sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          initialState={{ sorting: { sortModel: [{ field: 'index', sort: 'asc' }] } }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.75, py: 1, fontSize: 11.5, color: 'text.disabled' }}>
          <span>{rows.length} events · click a row to jump there</span>
          <span>Video time · local clock time below</span>
        </Box>
      </Box>
    </Box>
  )
}

function TwoLineTime({ seconds, recordedAt }: { seconds: number; recordedAt: string | null }): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
      <Typography variant="mono" sx={{ fontSize: 12 }}>
        {formatVideoTime(seconds)}
      </Typography>
      <Typography variant="mono" sx={{ fontSize: 10.5, color: 'text.disabled' }}>
        {recordedAt ? formatClockTime(recordedAt, seconds, { ms: true }) : ''}
      </Typography>
    </Box>
  )
}
