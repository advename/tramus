import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

import type { Job } from '../../api/types'
import { thumbnailUrl } from '../../api/urls'
import { Symbol } from '../../components/Symbol'
import { formatSecondsCompact } from '../../lib/time'
import { overallProgress, remainingSeconds, summarizeJobs } from './lib'

export interface RunStepProps {
  jobs: Job[]
  deviceLabel: string
  parallelJobs: number
  onCancelAll: () => void
  onCancelJob: (jobId: string) => void
}

/** Batch step 3: live progress for every job in the batch — `designs/Screens.dc.html` §isRun. */
export function RunStep({
  jobs,
  deviceLabel,
  parallelJobs,
  onCancelAll,
  onCancelJob
}: RunStepProps): React.JSX.Element {
  const counts = summarizeJobs(jobs)
  const progress = Math.round(overallProgress(jobs) * 100)
  const remaining = remainingSeconds(jobs)
  const canCancelAny = counts.running + counts.waiting > 0

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
      <Box
        sx={{
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
            Tracking {counts.total} videos · {parallelJobs} at a time
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            {counts.done} done · {counts.running} running · {counts.waiting} waiting
            {remaining != null ? ` · about ${formatSecondsCompact(remaining)} left` : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="mono" sx={{ fontSize: 15 }}>
            {progress}%
          </Typography>
        </Box>
        <Box sx={{ height: 6, borderRadius: '3px', bgcolor: 'surface.raised', overflow: 'hidden' }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: '100%',
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' }
            }}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.25,
            flexWrap: 'wrap'
          }}
        >
          <Typography variant="caption" color="text.disabled">
            {deviceLabel} · you can keep working in other videos
          </Typography>
          <Button
            variant="outlined"
            disabled={!canCancelAny}
            onClick={onCancelAll}
            sx={{ height: 28, px: 1.5, fontSize: 12.5 }}
          >
            Cancel all
          </Button>
        </Box>
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
        {jobs.map((job) => (
          <QueueRow key={job.id} job={job} onCancel={() => onCancelJob(job.id)} />
        ))}
      </Box>
    </Box>
  )
}

const STATUS_LABEL: Record<Job['state'], string> = {
  queued: 'Waiting',
  running: 'Tracking',
  succeeded: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

function QueueRow({ job, onCancel }: { job: Job; onCancel: () => void }): React.JSX.Element {
  const pct = Math.round(job.progress * 100)
  const canCancel = job.state === 'running' || job.state === 'queued'
  const meta =
    job.state === 'running'
      ? [
          job.fps != null ? `${Math.round(job.fps)} fps` : null,
          job.remaining_s != null ? formatSecondsCompact(job.remaining_s) : null
        ]
          .filter(Boolean)
          .join(' · ')
      : job.state === 'succeeded'
        ? `${job.flag_count ?? 0} ${job.flag_count === 1 ? 'flag' : 'flags'}`
        : job.state === 'failed'
          ? (job.error ?? 'Failed')
          : job.state === 'cancelled'
            ? 'Cancelled'
            : 'Waiting'

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '44px minmax(140px, 1fr) 112px minmax(120px, 1.2fr) 110px 32px',
        gap: 1.5,
        alignItems: 'center',
        px: 1.75,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        opacity: job.state === 'cancelled' ? 0.55 : 1
      }}
    >
      <Box
        component="img"
        src={thumbnailUrl(job.video_id, { maxSide: 96 })}
        alt=""
        sx={{ width: 44, height: 37, borderRadius: '4px', objectFit: 'cover', bgcolor: 'canvas' }}
      />
      <Typography sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
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
            bgcolor:
              job.state === 'succeeded' || job.state === 'running'
                ? job.state === 'succeeded'
                  ? 'success.main'
                  : 'primary.main'
                : 'text.disabled'
          }}
        />
        {STATUS_LABEL[job.state]}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            flex: 1,
            height: 4,
            borderRadius: '2px',
            bgcolor: 'surface.raised',
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              width: `${pct}%`,
              height: '100%',
              bgcolor: job.state === 'succeeded' ? 'success.main' : 'primary.main'
            }}
          />
        </Box>
        <Typography variant="mono" sx={{ fontSize: 11.5, width: 36, textAlign: 'right' }}>
          {job.state === 'cancelled' ? '—' : `${pct}%`}
        </Typography>
      </Box>
      <Typography
        variant="mono"
        color="text.disabled"
        sx={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
        noWrap
      >
        {meta}
      </Typography>
      {canCancel ? (
        <IconButton title="Cancel this video" onClick={onCancel} sx={{ color: 'text.secondary' }}>
          <Symbol name="close" size={17} />
        </IconButton>
      ) : (
        <Box />
      )}
    </Box>
  )
}
