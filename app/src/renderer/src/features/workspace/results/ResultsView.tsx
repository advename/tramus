import { useNavigate, useSearchParams } from 'react-router'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import { useBatch } from '../../../api/queries'
import type { ZoneVisit } from '../../../api/types'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'
import { ExportDialog, useExportDialog } from '../../export'
import { useResults, useSession } from '../data'
import { defaultExportPath } from '../lib/exportPath'
import { trialSummaryText } from '../lib/session'
import { useWorkspaceStore, type ResultsView as ResultsViewKind } from '../state/workspaceStore'
import { CrossingsView } from './CrossingsView'
import { EventsGrid } from './EventsGrid'
import { SummaryChart } from './SummaryChart'
import { SummaryTable } from './SummaryTable'

export interface ResultsViewProps {
  videoId: string
}

const RESULTS_VIEW_LABEL: Record<ResultsViewKind, string> = {
  summary: 'Summary',
  events: 'Events',
  crossings: 'Crossings'
}

/** The stage-area replacement for the Results step (design: `isResults` block). */
export function ResultsView({ videoId }: ResultsViewProps): React.JSX.Element {
  const navigate = useNavigate()
  const session = useSession(videoId)
  const results = useResults(videoId)
  const resultsView = useWorkspaceStore((s) => s.resultsView)
  const setResultsView = useWorkspaceStore((s) => s.setResultsView)
  const seek = useWorkspaceStore((s) => s.seek)
  const exportDialog = useExportDialog()

  // Batch review mode (`?batch=<id>`, set by `features/batch/FinishStep.tsx`'s "Open in Review"):
  // a "Next video" action alongside Export, stepping to the batch's next item.
  const [searchParams] = useSearchParams()
  const batchId = searchParams.get('batch')
  const batch = useBatch(batchId ?? undefined)
  const batchItems = batch.data?.items ?? []
  const batchIndex = batchId ? batchItems.findIndex((item) => item.video_id === videoId) : -1
  const nextBatchItem = batchIndex === -1 ? null : (batchItems[batchIndex + 1] ?? null)

  const video = session.data?.video
  const setup = session.data?.document.setup
  const recordedAt = session.data?.document.video.recorded_at ?? null

  const goToVisit = (visit: ZoneVisit): void => {
    void navigate(`/videos/${videoId}/review`)
    seek(visit.frame_enter)
  }

  if (!results.data || !video || !setup) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  const r = results.data

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        p: '14px 18px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box
          sx={{
            display: 'flex',
            gap: 0.25,
            p: 0.375,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: '9px'
          }}
        >
          {(['summary', 'events', 'crossings'] as const).map((view) => (
            <Button
              key={view}
              onClick={() => setResultsView(view)}
              sx={{
                height: 28,
                px: 1.5,
                borderRadius: '6px',
                fontSize: 12.5,
                fontWeight: 500,
                bgcolor: resultsView === view ? 'surface.raised' : 'transparent',
                color: resultsView === view ? 'text.primary' : 'text.secondary',
                '&:hover': { bgcolor: resultsView === view ? 'surface.raised' : 'surface.hover' }
              }}
            >
              {RESULTS_VIEW_LABEL[view]}
            </Button>
          ))}
        </Box>
        <Typography
          variant="mono"
          sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}
        >
          {trialSummaryText(r)}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {batchId && nextBatchItem ? (
          <Button
            variant="outlined"
            onClick={() =>
              void navigate(`/videos/${nextBatchItem.video_id}/review?batch=${batchId}`)
            }
            endIcon={<Symbol name="arrow_forward" size={16} />}
            sx={{ height: 30, fontWeight: 500 }}
          >
            Next video
          </Button>
        ) : null}
        <ShortcutTooltip title="Export">
          <Button
            variant="contained"
            onClick={() =>
              exportDialog.open({
                videoIds: [videoId],
                getDefaultPath: (format) => defaultExportPath(video.path, format)
              })
            }
            startIcon={<Symbol name="download" size={16} />}
            sx={{ height: 30, fontWeight: 600 }}
          >
            Export…
          </Button>
        </ShortcutTooltip>
      </Box>

      <ExportDialog
        open={exportDialog.isOpen}
        onClose={exportDialog.close}
        videoIds={exportDialog.videoIds}
        getDefaultPath={exportDialog.getDefaultPath}
      />

      {resultsView === 'summary' ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 1.75
            }}
          >
            <SummaryTable results={r} />
            <SummaryChart results={r} />
          </Box>
          <DistanceTravelled distanceMm={r.distance_mm ?? null} />
        </>
      ) : resultsView === 'events' ? (
        <EventsGrid results={r} recordedAt={recordedAt} onRowClick={goToVisit} />
      ) : (
        <CrossingsView videoId={videoId} setup={setup} results={r} recordedAt={recordedAt} />
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          fontSize: 11.5,
          color: 'text.disabled'
        }}
      >
        <Symbol name="schedule" size={15} />
        Times are stored in UTC and shown in this computer’s time zone.
      </Box>
    </Box>
  )
}

interface DistanceTravelledProps {
  /** `Results.distance_mm` — `null` without a calibration (`Setup.calibration`, §5.5). */
  distanceMm: number | null
}

/** "Distance travelled · 12.34 m", or a hint to set a scale — design: Summary view footnote. */
function DistanceTravelled({ distanceMm }: DistanceTravelledProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: 12.5,
        color: distanceMm != null ? 'text.secondary' : 'text.disabled'
      }}
    >
      <Symbol name="route" size={16} />
      {distanceMm != null ? (
        <>
          Distance travelled ·{' '}
          <Typography component="span" variant="mono" sx={{ fontSize: 12.5 }}>
            {(distanceMm / 1000).toFixed(2)} m
          </Typography>
        </>
      ) : (
        'Set a scale with the Measure tool to see distance'
      )}
    </Box>
  )
}
