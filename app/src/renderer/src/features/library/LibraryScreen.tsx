import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'

import { useExportVideos, useLibrary } from '../../api/queries'
import { queryKeys } from '../../api/queryKeys'
import type { VideoSummary } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { useShortcut } from '../../lib/shortcuts'
import { useCurrentFolderStore } from '../../stores/currentFolder'
import { notify, notifyError } from '../../stores/notifications'
import { ApplyTemplateDialog } from './ApplyTemplateDialog'
import { LibraryGrid } from './LibraryGrid'
import { LibraryHeader, type StatusFilter } from './LibraryHeader'
import { LibraryTable } from './LibraryTable'
import { hasResults, loadViewMode, saveViewMode, stepForStatus, type LibraryViewMode } from './lib'
import { SelectionBar } from './SelectionBar'

async function openFolderDialog(navigate: (href: string) => void): Promise<void> {
  const path = await window.tramus.dialog.openFolder()
  if (path) navigate(`/library?folder=${encodeURIComponent(path)}`)
}

/** The Library screen (`designs/Screens.dc.html` §library / §libraryGrid / §libraryEmpty). */
export function LibraryScreen(): React.JSX.Element {
  const [searchParams] = useSearchParams()
  const folderPath = searchParams.get('folder') ?? undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setCurrentFolder = useCurrentFolderStore((state) => state.setFolder)

  const { data, isLoading, isError, error, refetch, isFetching } = useLibrary(folderPath)

  useEffect(() => {
    if (data) setCurrentFolder({ path: data.folder.path, name: data.folder.name })
  }, [data, setCurrentFolder])

  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => loadViewMode())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false)
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const exportVideos = useExportVideos()

  useShortcut('mod+f', () => searchInputRef.current?.focus())
  useShortcut('mod+shift+1', () => changeViewMode('table'))
  useShortcut('mod+shift+2', () => changeViewMode('grid'))
  useShortcut('esc', () => setSelectedIds([]), {
    enabled: selectedIds.length > 0,
    preventDefault: false
  })
  useShortcut('mod+o', () => void openFolderDialog((href) => void navigate(href)))
  useShortcut(
    'mod+t',
    () => {
      if (selectedIds.length > 0) void navigate(`/batch?videos=${selectedIds.join(',')}`)
    },
    { enabled: selectedIds.length > 0 }
  )

  function changeViewMode(mode: LibraryViewMode): void {
    setViewMode(mode)
    saveViewMode(mode)
  }

  const videos = useMemo(() => data?.videos ?? [], [data?.videos])
  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase()
    return videos.filter((video) => {
      if (statusFilter !== 'all' && video.status !== statusFilter) return false
      if (query && !video.file_name.toLowerCase().includes(query)) return false
      return true
    })
  }, [videos, search, statusFilter])

  const selectedVideos = videos.filter((video) => selectedIds.includes(video.id))
  const exportableIds = selectedVideos.filter((v) => hasResults(v.status)).map((v) => v.id)

  const openVideo = (video: VideoSummary): void => {
    void navigate(`/videos/${video.id}/${stepForStatus(video.status)}`)
  }

  const handleExport = async (format: 'xlsx' | 'csv'): Promise<void> => {
    setExportAnchor(null)
    if (exportableIds.length === 0) return
    const defaultName = `${data?.folder.name ?? 'results'}.${format === 'xlsx' ? 'xlsx' : 'csv'}`
    const path = await window.tramus.dialog.saveFile({
      defaultPath: defaultName,
      filters:
        format === 'xlsx'
          ? [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
          : [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!path) return
    exportVideos.mutate(
      { videoIds: exportableIds, format, path },
      {
        onSuccess: () => {
          notify({
            severity: 'success',
            title: 'Export complete',
            action: {
              label: 'Show in folder',
              onClick: () => void window.tramus.shell.showItemInFolder(path)
            }
          })
        },
        onError: (err) => notifyError('Export failed', err)
      }
    )
  }

  if (!folderPath) {
    return (
      <EmptyState
        icon="video_library"
        title="No folder open"
        description="Open a folder of videos from Start to see them here."
        action={
          <Button variant="contained" onClick={() => void navigate('/')}>
            Go to Start
          </Button>
        }
      />
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon="error"
        title="Couldn't open this folder"
        description={error instanceof Error ? error.message : 'Unexpected error.'}
        action={
          <Button variant="contained" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <LibraryHeader
        folderName={data.folder.name}
        folderPath={`${data.folder.path} · ${data.folder.video_count} videos`}
        search={search}
        onSearchChange={setSearch}
        searchInputRef={searchInputRef}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        onOpenFolder={() => void openFolderDialog((href) => void navigate(href))}
      />

      {selectedIds.length > 0 ? (
        <SelectionBar
          count={selectedIds.length}
          canExport={exportableIds.length > 0}
          onApplyTemplate={() => setApplyTemplateOpen(true)}
          onTrack={() => void navigate(`/batch?videos=${selectedIds.join(',')}`)}
          onExport={setExportAnchor}
          onClear={() => setSelectedIds([])}
        />
      ) : null}

      {videos.length === 0 ? (
        <EmptyState
          icon="video_file"
          title="No videos in this folder"
          description="Tramus looks for .mp4, .avi, .mov and .mkv files directly in the folder. Subfolders aren't searched."
          action={
            <>
              <Button
                variant="contained"
                onClick={() => void openFolderDialog((href) => void navigate(href))}
              >
                Open another folder
              </Button>
              <Button
                variant="outlined"
                onClick={() => void window.tramus.shell.showItemInFolder(data.folder.path)}
              >
                Show in file manager
              </Button>
            </>
          }
        />
      ) : filteredVideos.length === 0 ? (
        <EmptyState icon="search_off" title="No videos match your search" />
      ) : viewMode === 'table' ? (
        <LibraryTable
          videos={filteredVideos}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onOpen={openVideo}
        />
      ) : (
        <LibraryGrid
          videos={filteredVideos}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onOpen={openVideo}
        />
      )}

      {isFetching && !isLoading ? (
        <Box sx={{ position: 'fixed', top: 8, right: 8 }}>
          <CircularProgress size={16} />
        </Box>
      ) : null}

      <ApplyTemplateDialog
        open={applyTemplateOpen}
        videoIds={selectedIds}
        onCancel={() => setApplyTemplateOpen(false)}
        onApplied={() => {
          setApplyTemplateOpen(false)
          void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
          notify({ severity: 'success', title: `Template applied to ${selectedIds.length} videos` })
        }}
      />

      <Menu
        anchorEl={exportAnchor}
        open={exportAnchor !== null}
        onClose={() => setExportAnchor(null)}
      >
        <MenuItem onClick={() => void handleExport('xlsx')}>Export as Excel (.xlsx)</MenuItem>
        <MenuItem onClick={() => void handleExport('csv')}>Export as CSV</MenuItem>
      </Menu>
    </Box>
  )
}
