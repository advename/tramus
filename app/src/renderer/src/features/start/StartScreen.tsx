import { type DragEvent, useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router'

import { useRecentFolders } from '../../api/queries'
import type { RecentFolder } from '../../api/types'
import { Kbd } from '../../components/Kbd'
import { Symbol } from '../../components/Symbol'
import { formatRelativeDate } from '../../lib/time'
import { useShortcut } from '../../lib/shortcuts'
import { notifyError } from '../../stores/notifications'

function libraryHref(path: string): string {
  return `/library?folder=${encodeURIComponent(path)}`
}

/** A `File` from an Electron drop event carries the absolute filesystem path. */
function electronFilePath(file: File): string | undefined {
  return (file as unknown as { path?: string }).path
}

/**
 * First-launch / "open a folder" screen (`designs/Screens.dc.html` §start): open-folder button,
 * drag-and-drop anywhere in the window, and the list of recently opened folders.
 */
export function StartScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { data: recentFolders, isLoading } = useRecentFolders()
  const [dragging, setDragging] = useState(false)
  const [opening, setOpening] = useState(false)

  const openFolder = useCallback(async (): Promise<void> => {
    setOpening(true)
    try {
      const path = await window.tramus.dialog.openFolder()
      if (path) void navigate(libraryHref(path))
    } catch (error) {
      notifyError('Could not open that folder', error)
    } finally {
      setOpening(false)
    }
  }, [navigate])

  useShortcut('mod+o', () => void openFolder())

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragging(false)
      const file = event.dataTransfer.files[0]
      const path = file ? electronFilePath(file) : undefined
      if (path) void navigate(libraryHref(path))
    },
    [navigate]
  )

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        p: 4,
        overflow: 'auto',
        outline: dragging ? 2 : 0,
        outlineColor: 'primary.main',
        outlineOffset: -2,
        transition: 'outline-color 120ms'
      }}
    >
      <Box sx={{ width: 'min(560px, 100%)', display: 'flex', flexDirection: 'column', gap: 3.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '11px',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 600,
              fontSize: 22
            }}
          >
            T
          </Box>
          <Typography sx={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Tramus
          </Typography>
          <Typography color="text.secondary" sx={{ textWrap: 'pretty' }}>
            Open a folder of top-down videos to set up zones, track the mouse and measure time in
            each zone.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={() => void openFolder()}
            disabled={opening}
            startIcon={
              opening ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Symbol name="folder_open" size={19} />
              )
            }
            sx={{ height: 38, px: 2, fontSize: 14, fontWeight: 600, gap: 1 }}
          >
            Open folder…
            <Kbd variant="onPrimary">Ctrl+O</Kbd>
          </Button>
          <Typography variant="caption" color="text.disabled">
            or drop a folder anywhere in this window
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="overline" color="text.disabled" sx={{ px: 1.25, pb: 0.75 }}>
            Recent folders
          </Typography>
          {isLoading ? (
            <Typography variant="body2" color="text.disabled" sx={{ px: 1.25 }}>
              Loading…
            </Typography>
          ) : recentFolders && recentFolders.length > 0 ? (
            recentFolders.map((folder) => <RecentFolderRow key={folder.path} folder={folder} />)
          ) : (
            <Typography variant="body2" color="text.disabled" sx={{ px: 1.25 }}>
              Folders you open will show up here.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}

interface RecentFolderRowProps {
  folder: RecentFolder
}

function RecentFolderRow({ folder }: RecentFolderRowProps): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <Box
      onClick={() => void navigate(libraryHref(folder.path))}
      sx={{
        display: 'grid',
        gridTemplateColumns: '20px minmax(0, 1fr) auto',
        gap: 1.5,
        alignItems: 'center',
        px: 1.25,
        py: 1.1,
        borderRadius: '8px',
        cursor: 'pointer',
        '&:hover': { bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06) }
      }}
    >
      <Symbol name="folder" size={19} sx={{ color: 'text.secondary' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500 }}>{folder.name}</Typography>
        <Typography
          variant="mono"
          color="text.disabled"
          sx={{
            fontSize: 11.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {folder.path}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          fontSize: 11.5,
          color: 'text.disabled',
          whiteSpace: 'nowrap'
        }}
      >
        <span>
          {folder.video_count} {folder.video_count === 1 ? 'video' : 'videos'}
        </span>
        <span>{formatRelativeDate(folder.last_opened_at)}</span>
      </Box>
    </Box>
  )
}
