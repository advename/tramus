import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'

import { thumbnailUrl } from '../../api/urls'
import type { VideoSummary } from '../../api/types'
import { StatusChip } from '../../components/StatusChip'
import { Symbol } from '../../components/Symbol'
import { TimeText } from '../../components/TimeText'
import { formatClockTime, formatDate } from '../../lib/time'

export interface LibraryGridProps {
  videos: VideoSummary[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onOpen: (video: VideoSummary) => void
}

/** The Library's grid view: a card per video, per `designs/Screens.dc.html` §libraryGrid. */
export function LibraryGrid({
  videos,
  selectedIds,
  onSelectionChange,
  onOpen
}: LibraryGridProps): React.JSX.Element {
  const selected = new Set(selectedIds)

  const toggle = (id: string): void => {
    onSelectionChange(
      selected.has(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]
    )
  }

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
        p: 2,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: 1.75,
        alignContent: 'start'
      }}
    >
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          selected={selected.has(video.id)}
          onToggleSelect={() => toggle(video.id)}
          onOpen={() => onOpen(video)}
        />
      ))}
    </Box>
  )
}

interface VideoCardProps {
  video: VideoSummary
  selected: boolean
  onToggleSelect: () => void
  onOpen: () => void
}

function VideoCard({ video, selected, onToggleSelect, onOpen }: VideoCardProps): React.JSX.Element {
  return (
    <Box
      onDoubleClick={onOpen}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: '10px',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        cursor: 'pointer',
        '&:hover': { borderColor: 'surface.lineStrong' }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: `${video.width} / ${video.height}`,
          bgcolor: 'canvas'
        }}
      >
        <Box
          component="img"
          src={thumbnailUrl(video.id, { maxSide: 420 })}
          alt=""
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Checkbox
          checked={selected}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSelect()
          }}
          onChange={() => {}}
          size="small"
          sx={{
            position: 'absolute',
            top: 4,
            left: 4,
            p: 0.5,
            bgcolor: 'surface.dim',
            borderRadius: '4px',
            '&:hover': { bgcolor: 'surface.dim' }
          }}
        />
        {video.unresolved_flags > 0 ? (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              height: 20,
              px: 0.875,
              borderRadius: '10px',
              bgcolor: 'warning.main',
              color: 'common.black',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 11,
              fontWeight: 600
            }}
          >
            {video.unresolved_flags} flags
          </Box>
        ) : null}
        <Box
          sx={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            px: 0.75,
            py: '1px',
            borderRadius: '4px',
            bgcolor: 'surface.dim',
            color: 'common.white',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11
          }}
        >
          <TimeText seconds={video.duration_s} format="video" sx={{ color: 'inherit', fontSize: 11 }} />
        </Box>
      </Box>
      <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
            {video.file_name}
          </Typography>
          {video.file_changed ? (
            <Symbol
              name="warning"
              size={16}
              sx={{ color: 'warning.main', flexShrink: 0 }}
              title="File changed since it was analysed"
            />
          ) : null}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="mono" color="text.disabled" sx={{ fontSize: 11.5 }} noWrap>
            {video.recorded_at
              ? `${formatDate(video.recorded_at)} · ${formatClockTime(video.recorded_at, 0)}`
              : '—'}
          </Typography>
          <StatusChip status={video.status} />
        </Box>
      </Box>
    </Box>
  )
}
