import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useNavigate } from 'react-router'

import type { BatchItemView } from '../../api/types'
import { thumbnailUrl } from '../../api/urls'
import { Symbol } from '../../components/Symbol'
import { batchRowStatus, type BatchRowStatus } from './lib'

export interface FinishStepProps {
  batchId: string
  items: BatchItemView[]
  onExportAll: () => void
}

function rowStatusLabel(status: BatchRowStatus): string {
  switch (status.kind) {
    case 'queued':
      return 'Waiting'
    case 'tracking':
      return `Tracking ${Math.round(status.progress * 100)}%`
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'flags':
      return status.count > 0
        ? `${status.count} ${status.count === 1 ? 'flag' : 'flags'} left`
        : 'No flags'
    case 'reviewed':
      return 'Reviewed'
    case 'not_tracked':
      return 'Not tracked'
  }
}

function rowStatusColor(
  status: BatchRowStatus
): 'success.main' | 'warning.main' | 'error.main' | 'text.disabled' {
  switch (status.kind) {
    case 'reviewed':
      return 'success.main'
    case 'flags':
      return status.count > 0 ? 'warning.main' : 'success.main'
    case 'failed':
      return 'error.main'
    default:
      return 'text.disabled'
  }
}

/** Batch step 4: a per-video overview + a one-workbook export — `designs/Screens.dc.html` §isFinish. */
export function FinishStep({ batchId, items, onExportAll }: FinishStepProps): React.JSX.Element {
  const navigate = useNavigate()
  const statuses = items.map((item) => ({ item, status: batchRowStatus(item) }))
  const reviewedCount = statuses.filter(({ status }) => status.kind === 'reviewed').length
  const flagsRemaining = statuses.reduce(
    (total, { status }) => total + (status.kind === 'flags' ? status.count : 0),
    0
  )
  const failedCount = statuses.filter(({ status }) => status.kind === 'failed').length
  const exportable = statuses.some(
    ({ status }) => status.kind === 'flags' || status.kind === 'reviewed'
  )

  const summaryParts = [`${reviewedCount} of ${items.length} reviewed`]
  if (failedCount > 0) summaryParts.push(`${failedCount} failed`)

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{summaryParts.join(' · ')}</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            Review each video's flags before exporting, or export now and review later.
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={!exportable}
          onClick={onExportAll}
          startIcon={<Symbol name="download" size={17} />}
          sx={{ height: 34, px: 1.75, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          Export all to one workbook
        </Button>
      </Box>

      {flagsRemaining > 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.875,
            borderRadius: '8px',
            bgcolor: (theme) => `${theme.palette.warning.main}26`,
            color: 'warning.main',
            fontSize: 12.5
          }}
        >
          <Symbol name="warning" size={16} />
          {flagsRemaining} {flagsRemaining === 1 ? 'flag' : 'flags'} still need review across this
          batch.
        </Box>
      ) : null}

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px',
          bgcolor: 'background.paper',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '44px minmax(140px, 1fr) 160px 150px',
            gap: 1.5,
            alignItems: 'center',
            px: 1.75,
            height: 34,
            fontSize: 11.5,
            color: 'text.disabled',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <span />
          <span>Video</span>
          <span>Status</span>
          <span />
        </Box>
        {items.map(({ video_id: videoId, file_name: fileName }) => {
          const { status } = statuses.find((s) => s.item.video_id === videoId)!
          const canReview = status.kind === 'flags' || status.kind === 'reviewed'
          return (
            <Box
              key={videoId}
              sx={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(140px, 1fr) 160px 150px',
                gap: 1.5,
                alignItems: 'center',
                px: 1.75,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider'
              }}
            >
              <Box
                component="img"
                src={thumbnailUrl(videoId, { maxSide: 96 })}
                alt=""
                sx={{
                  width: 44,
                  height: 37,
                  borderRadius: '4px',
                  objectFit: 'cover',
                  bgcolor: 'canvas'
                }}
              />
              <Typography
                sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
                noWrap
              >
                {fileName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {status.kind === 'tracking' ? (
                  <CircularProgress size={13} value={status.progress * 100} variant="determinate" />
                ) : (
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: rowStatusColor(status)
                    }}
                  />
                )}
                <Typography
                  variant="mono"
                  sx={{ fontSize: 12, color: rowStatusColor(status) }}
                  title={status.kind === 'failed' ? (status.error ?? undefined) : undefined}
                >
                  {rowStatusLabel(status)}
                </Typography>
              </Box>
              {canReview ? (
                <Button
                  variant="outlined"
                  onClick={() => void navigate(`/videos/${videoId}/review?batch=${batchId}`)}
                  endIcon={<Symbol name="arrow_forward" size={16} />}
                  sx={{
                    height: 28,
                    px: 1.25,
                    fontSize: 12.5,
                    fontWeight: 500,
                    justifySelf: 'end',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Open in Review
                </Button>
              ) : (
                <Box />
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
