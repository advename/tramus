import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useNavigate } from 'react-router'

import type { Job } from '../../api/types'
import { thumbnailUrl } from '../../api/urls'
import { Symbol } from '../../components/Symbol'
import { summarizeJobs } from './lib'

export interface FinishStepProps {
  jobs: Job[]
  onExportAll: () => void
  exporting: boolean
}

const STATUS_LABEL: Record<Job['state'], string> = {
  queued: 'Waiting',
  running: 'Tracking',
  succeeded: 'Tracked',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

/** Batch step 4: per-video outcome + a one-workbook export — `designs/Screens.dc.html` §isFinish. */
export function FinishStep({ jobs, onExportAll, exporting }: FinishStepProps): React.JSX.Element {
  const navigate = useNavigate()
  const counts = summarizeJobs(jobs)
  const succeeded = jobs.filter((j) => j.state === 'succeeded')

  const summaryParts = [`${counts.done} ${counts.done === 1 ? 'video' : 'videos'} tracked`]
  if (counts.cancelled > 0) summaryParts.push(`${counts.cancelled} cancelled`)
  if (counts.failed > 0) summaryParts.push(`${counts.failed} failed`)

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
          disabled={succeeded.length === 0 || exporting}
          onClick={onExportAll}
          startIcon={<Symbol name="download" size={17} />}
          sx={{ height: 34, px: 1.75, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          Export all to one workbook
        </Button>
      </Box>

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
            gridTemplateColumns: '44px minmax(140px, 1fr) 112px 130px 150px',
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
          <span>Flags to review</span>
          <span />
        </Box>
        {jobs.map((job) => (
          <Box
            key={job.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: '44px minmax(140px, 1fr) 112px 130px 150px',
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
              src={thumbnailUrl(job.video_id, { maxSide: 96 })}
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
              {job.video_name}
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                height: 22,
                px: 1,
                border: 1,
                borderColor: 'surface.lineStrong',
                borderRadius: '11px',
                fontSize: 11.5,
                fontWeight: 500,
                justifySelf: 'start',
                whiteSpace: 'nowrap'
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: job.state === 'succeeded' ? 'primary.main' : 'text.disabled'
                }}
              />
              {STATUS_LABEL[job.state]}
            </Box>
            {job.state === 'succeeded' ? (
              (job.flag_count ?? 0) > 0 ? (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.625,
                    height: 22,
                    px: 1,
                    borderRadius: '11px',
                    bgcolor: (theme) => `${theme.palette.warning.main}26`,
                    color: 'warning.main',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 12,
                    fontWeight: 500,
                    justifySelf: 'start'
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
                  {job.flag_count} {job.flag_count === 1 ? 'flag' : 'flags'}
                </Box>
              ) : (
                <Typography variant="caption" color="text.disabled">
                  None
                </Typography>
              )
            ) : (
              <Typography variant="caption" color="text.disabled">
                Not tracked
              </Typography>
            )}
            {job.state === 'succeeded' ? (
              <Button
                variant="outlined"
                onClick={() => void navigate(`/videos/${job.video_id}/review`)}
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
        ))}
      </Box>
    </Box>
  )
}
