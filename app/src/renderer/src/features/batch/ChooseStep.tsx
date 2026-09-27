import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Radio from '@mui/material/Radio'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { thumbnailUrl } from '../../api/urls'
import type { Template, VideoSummary } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { StatusChip } from '../../components/StatusChip'
import { formatShortDuration } from '../../lib/time'
import { formatTemplateMeta, formatTemplateSaved } from '../templates/templateFormat'
import { TemplatePreview } from '../templates/TemplatePreview'

type VideoFilter = 'not_tracked' | 'all'

const NOT_TRACKED: ReadonlySet<VideoSummary['status']> = new Set(['new', 'set_up'])

export interface ChooseStepProps {
  videos: VideoSummary[]
  selectedVideoIds: string[]
  onChangeSelected: (ids: string[]) => void
  templates: Template[]
  selectedTemplateId: string | null
  onChangeTemplate: (id: string) => void
}

/** Batch step 1: pick videos from the current library folder and a template. */
export function ChooseStep({
  videos,
  selectedVideoIds,
  onChangeSelected,
  templates,
  selectedTemplateId,
  onChangeTemplate
}: ChooseStepProps): React.JSX.Element {
  const [filter, setFilter] = useState<VideoFilter>('not_tracked')
  const selected = new Set(selectedVideoIds)

  const visibleVideos = useMemo(
    () => (filter === 'all' ? videos : videos.filter((v) => NOT_TRACKED.has(v.status))),
    [videos, filter]
  )

  const toggle = (id: string): void => {
    onChangeSelected(
      selected.has(id) ? selectedVideoIds.filter((existing) => existing !== id) : [...selectedVideoIds, id]
    )
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.75, pb: 1.25, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 600 }}>Videos</Typography>
          <Typography variant="caption" color="text.disabled">
            {selectedVideoIds.length} of {videos.length} selected
          </Typography>
          <Box sx={{ flex: 1 }} />
          <FilterChip label="Not tracked yet" active={filter === 'not_tracked'} onClick={() => setFilter('not_tracked')} />
          <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {visibleVideos.length === 0 ? (
            <EmptyState icon="video_file" title="No videos match this filter" />
          ) : (
            visibleVideos.map((video) => (
              <Box
                key={video.id}
                onClick={() => toggle(video.id)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '20px 44px minmax(0, 1fr) auto',
                  gap: 1.5,
                  alignItems: 'center',
                  px: 2,
                  py: 0.75,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: selected.has(video.id)
                    ? (theme) => alpha(theme.palette.primary.main, 0.13)
                    : 'transparent',
                  cursor: 'pointer'
                }}
              >
                <Checkbox checked={selected.has(video.id)} size="small" sx={{ p: 0 }} readOnly />
                <Box
                  component="img"
                  src={thumbnailUrl(video.id, { maxSide: 96 })}
                  alt=""
                  sx={{ width: 44, height: 37, borderRadius: '4px', objectFit: 'cover', bgcolor: 'canvas' }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 500 }} noWrap>
                    {video.file_name}
                  </Typography>
                  <Typography variant="mono" color="text.disabled" sx={{ fontSize: 11 }}>
                    {formatShortDuration(video.duration_s)}
                  </Typography>
                </Box>
                <StatusChip status={video.status} />
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          px: 2,
          py: 1.75,
          overflow: 'auto',
          bgcolor: 'background.paper'
        }}
      >
        <Typography sx={{ fontWeight: 600 }}>Template</Typography>
        {templates.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            No templates saved yet. Save one from a video's Setup step first.
          </Typography>
        ) : (
          templates.map((template) => {
            const active = template.id === selectedTemplateId
            return (
              <Box
                key={template.id}
                onClick={() => onChangeTemplate(template.id)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '18px 76px minmax(0, 1fr)',
                  gap: 1.5,
                  alignItems: 'center',
                  p: 1.25,
                  borderRadius: '10px',
                  border: 1,
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? (theme) => alpha(theme.palette.primary.main, 0.13) : 'transparent',
                  cursor: 'pointer'
                }}
              >
                <Radio checked={active} size="small" sx={{ p: 0 }} readOnly />
                <Box sx={{ position: 'relative', width: 76, height: 65, borderRadius: '5px', overflow: 'hidden', bgcolor: 'canvas' }}>
                  <TemplatePreview template={template} />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0.25 }}>
                  <Typography sx={{ fontWeight: 500 }} noWrap>
                    {template.name}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" noWrap component="div">
                    {formatTemplateMeta(template)}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" noWrap component="div">
                    {formatTemplateSaved(template)}
                  </Typography>
                </Box>
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}

function FilterChip({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      variant="outlined"
      onClick={onClick}
      sx={{
        height: 26,
        px: 1.25,
        borderRadius: '13px',
        fontSize: 12,
        fontWeight: 400,
        color: 'text.primary',
        borderColor: active ? 'primary.main' : 'surface.lineStrong',
        bgcolor: active ? (theme) => alpha(theme.palette.primary.main, 0.13) : 'transparent'
      }}
    >
      {label}
    </Button>
  )
}
