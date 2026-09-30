import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'

import { ApiError } from '../../api/client'
import { useLibrary } from '../../api/queries'
import { queryKeys } from '../../api/queryKeys'
import type { VideoSummary } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { ExportDialog, useExportDialog } from '../export'
import { useShortcut } from '../../lib/shortcuts'
import { useCurrentFolderStore } from '../../stores/currentFolder'
import { useFolderAccessStore } from '../../stores/folderAccess'
import { notify } from '../../stores/notifications'
import { AccessDeniedState } from './AccessDeniedState'
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
  const markFolderAccessible = useFolderAccessStore((state) => state.markAccessible)
  const markFolderInaccessible = useFolderAccessStore((state) => state.markInaccessible)

  useEffect(() => {
    if (data) setCurrentFolder({ path: data.folder.path, name: data.folder.name })
  }, [data, setCurrentFolder])

  // Track whether the *last opened* folder is one the OS refused to read, so `StartScreen`'s
  // recent-folder list and `AppShell`'s Library shortcut can steer around it next time instead
  // of bouncing the user straight back into the same 403.
  useEffect(() => {
    if (!folderPath) return
    if (data) {
      markFolderAccessible(data.folder.path)
    } else if (error instanceof ApiError && error.status === 403) {
      markFolderInaccessible(folderPath, error.message)
    }
  }, [folderPath, data, error, markFolderAccessible, markFolderInaccessible])

  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => loadViewMode())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const exportDialog = useExportDialog()

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

  const openExport = (): void => {
    if (exportableIds.length === 0) return
    const folderName = data?.folder.name ?? 'results'
    exportDialog.open({
      videoIds: exportableIds,
      getDefaultPath: (format) => `${folderName}.${format}`
    })
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
    if (error instanceof ApiError && error.status === 403) {
      return (
        <AccessDeniedState
          detail={error.message}
          isRetrying={isFetching}
          onRetry={() => void refetch()}
          onChooseFolder={() => void openFolderDialog((href) => void navigate(href))}
        />
      )
    }
    return (
      <EmptyState
        icon="error"
        title="Couldn't open this folder"
        description={error instanceof Error ? error.message : 'Unexpected error.'}
        action={
          <Button
            variant="contained"
            onClick={() => void refetch()}
            disabled={isFetching}
            startIcon={isFetching ? <CircularProgress size={15} color="inherit" /> : undefined}
          >
            {isFetching ? 'Trying again…' : 'Try again'}
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
          onExport={openExport}
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

      <ExportDialog
        open={exportDialog.isOpen}
        onClose={exportDialog.close}
        videoIds={exportDialog.videoIds}
        getDefaultPath={exportDialog.getDefaultPath}
      />
    </Box>
  )
}
