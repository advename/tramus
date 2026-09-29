import { useNavigate } from 'react-router'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import { getApiClient, unwrap } from '../../../api/client'
import type { ZoneVisit } from '../../../api/types'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'
import { useResults, useSession } from '../data'
import { defaultExportPath } from '../lib/exportPath'
import { trialSummaryText } from '../lib/session'
import { useWorkspaceStore, type ResultsView as ResultsViewKind } from '../state/workspaceStore'
import { notify, notifyError } from '../../../stores/notifications'
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

async function runExport(
  videoId: string,
  format: 'xlsx' | 'csv',
  videoPath: string
): Promise<void> {
  const defaultPath = defaultExportPath(videoPath, format)
  const path = await window.tramus.dialog.saveFile({
    defaultPath,
    filters: [
      format === 'xlsx'
        ? { name: 'Excel Workbook', extensions: ['xlsx'] }
        : { name: 'CSV', extensions: ['csv'] }
    ]
  })
  if (!path) return
  try {
    const response = unwrap(
      await getApiClient().POST('/api/export', { body: { video_ids: [videoId], format, path } })
    )
    const file = response.files[0]
    notify({
      severity: 'success',
      title: 'Exported',
      message: response.files.join(', '),
      action: file
        ? {
            label: 'Show in folder',
            onClick: () => void window.tramus.shell.showItemInFolder(file)
          }
        : undefined
    })
  } catch (error) {
    notifyError('Couldn’t export', error)
  }
}

/** The stage-area replacement for the Results step (design: `isResults` block). */
export function ResultsView({ videoId }: ResultsViewProps): React.JSX.Element {
  const navigate = useNavigate()
  const session = useSession(videoId)
  const results = useResults(videoId)
  const resultsView = useWorkspaceStore((s) => s.resultsView)
  const setResultsView = useWorkspaceStore((s) => s.setResultsView)
  const seek = useWorkspaceStore((s) => s.seek)

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
        <ShortcutTooltip title="Export to Excel" shortcut="mod+e">
          <Button
            variant="contained"
            onClick={() => void runExport(videoId, 'xlsx', video.path)}
            startIcon={<Symbol name="download" size={16} />}
            sx={{ height: 30, fontWeight: 600 }}
          >
            Excel (.xlsx)
          </Button>
        </ShortcutTooltip>
        <ShortcutTooltip title="Export CSV" shortcut="mod+shift+e">
          <Button
            variant="outlined"
            onClick={() => void runExport(videoId, 'csv', video.path)}
            sx={{ height: 30 }}
          >
            CSV
          </Button>
        </ShortcutTooltip>
      </Box>

      {resultsView === 'summary' ? (
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
