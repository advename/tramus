import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import {
  DataGrid,
  type GridColDef,
  type GridRowParams,
  type GridRowSelectionModel
} from '@mui/x-data-grid'

import type { VideoSummary } from '../../api/types'
import { StatusChip } from '../../components/StatusChip'
import { Symbol } from '../../components/Symbol'
import { TimeText } from '../../components/TimeText'
import { thumbnailUrl } from '../../api/urls'
import { formatClockTime, formatDate } from '../../lib/time'
import { hasResults } from './lib'

export interface LibraryTableProps {
  videos: VideoSummary[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onOpen: (video: VideoSummary) => void
}

/** The Library's table view: an MUI X DataGrid with checkbox selection, per `designs/Screens.dc.html`. */
export function LibraryTable({
  videos,
  selectedIds,
  onSelectionChange,
  onOpen
}: LibraryTableProps): React.JSX.Element {
  const selectionModel: GridRowSelectionModel = useMemo(
    () => ({ type: 'include', ids: new Set(selectedIds) }),
    [selectedIds]
  )

  const columns: GridColDef<VideoSummary>[] = useMemo(
    () => [
      {
        field: 'thumbnail',
        headerName: '',
        width: 64,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Box
            component="img"
            src={thumbnailUrl(params.row.id, { maxSide: 128 })}
            alt=""
            sx={{
              width: 52,
              height: 44,
              borderRadius: '4px',
              objectFit: 'cover',
              bgcolor: 'canvas'
            }}
          />
        )
      },
      {
        field: 'file_name',
        headerName: 'Name',
        flex: 1.6,
        minWidth: 160,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Typography
              sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
              noWrap
            >
              {params.row.file_name}
            </Typography>
            {params.row.file_changed ? (
              <Symbol
                name="warning"
                size={16}
                sx={{ color: 'warning.main', flexShrink: 0 }}
                title="File changed since it was analysed"
              />
            ) : null}
          </Box>
        )
      },
      {
        field: 'duration_s',
        headerName: 'Duration',
        width: 116,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => <TimeText seconds={params.row.duration_s} format="video" />
      },
      {
        field: 'recorded_at',
        headerName: 'Recorded',
        minWidth: 150,
        flex: 1,
        renderCell: (params) => {
          const recordedAt = params.row.recorded_at
          if (!recordedAt) {
            return (
              <Typography variant="mono" color="text.disabled" sx={{ fontSize: 12 }}>
                —
              </Typography>
            )
          }
          return (
            <Typography variant="mono" color="text.secondary" sx={{ fontSize: 12 }} noWrap>
              {formatDate(recordedAt)} {formatClockTime(recordedAt, 0)}
            </Typography>
          )
        }
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 118,
        sortable: false,
        renderCell: (params) => <StatusChip status={params.row.status} />
      },
      {
        field: 'unresolved_flags',
        headerName: 'Flags',
        width: 70,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => <FlagsCell video={params.row} />
      },
      {
        field: 'actions',
        headerName: '',
        width: 36,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => <RowMenu video={params.row} />
      }
    ],
    []
  )

  return (
    <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <DataGrid
        rows={videos}
        columns={columns}
        rowHeight={52}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={(model) => {
          if (model.type === 'include') {
            onSelectionChange(Array.from(model.ids, String))
          } else {
            const excluded = model.ids
            onSelectionChange(videos.map((v) => v.id).filter((id) => !excluded.has(id)))
          }
        }}
        onRowDoubleClick={(params: GridRowParams<VideoSummary>) => onOpen(params.row)}
        initialState={{ sorting: { sortModel: [{ field: 'file_name', sort: 'asc' }] } }}
        pageSizeOptions={[]}
        hideFooter
        sx={{
          border: 0,
          '--DataGrid-rowBorderColor': 'transparent',
          '& .MuiDataGrid-row': {
            borderBottom: '1px solid',
            borderColor: 'divider',
            cursor: 'pointer'
          },
          '& .MuiDataGrid-columnHeaders': { borderBottom: '1px solid', borderColor: 'divider' },
          '& .MuiDataGrid-cell': { borderBottom: 'none', display: 'flex', alignItems: 'center' },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
          '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
            outline: 'none'
          }
        }}
      />
    </Box>
  )
}

function FlagsCell({ video }: { video: VideoSummary }): React.JSX.Element {
  if (!hasResults(video.status)) {
    return (
      <Typography variant="mono" color="text.disabled" sx={{ fontSize: 12 }}>
        —
      </Typography>
    )
  }
  if (video.unresolved_flags > 0) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          height: 20,
          px: 0.875,
          borderRadius: '10px',
          bgcolor: (theme) => `${theme.palette.warning.main}26`,
          color: 'warning.main'
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            transform: 'rotate(45deg)',
            bgcolor: 'warning.main'
          }}
        />
        <Typography variant="mono" sx={{ fontSize: 11.5, fontWeight: 500 }}>
          {video.unresolved_flags}
        </Typography>
      </Box>
    )
  }
  return (
    <Typography variant="mono" color="text.disabled" sx={{ fontSize: 12 }}>
      0
    </Typography>
  )
}

function RowMenu({ video }: { video: VideoSummary }): React.JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton
        onClick={(event) => {
          event.stopPropagation()
          setAnchor(event.currentTarget)
        }}
        sx={{ color: 'text.disabled' }}
      >
        <Symbol name="more_vert" size={18} />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={(_event, reason) => {
          setAnchor(null)
          if (reason) return
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null)
            void window.tramus.shell.showItemInFolder(video.path)
          }}
        >
          Show in file manager
        </MenuItem>
      </Menu>
    </>
  )
}
