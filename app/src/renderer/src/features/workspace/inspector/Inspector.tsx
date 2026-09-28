import { useNavigate } from 'react-router'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

import type { FlagView, HistoryEntry, Results, SessionState } from '../../../api/types'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'
import { formatDate, formatDuration, formatVideoTime } from '../../../lib/time'
import { useCorrectionsEditor, type SessionActions, type SetupEditor } from '../data'
import { countByStatus, useReopenFlag } from '../lib/flags'
import { estimateTrackingSeconds } from '../lib/session'
import { useWorkspaceStore, type InspectorTab, type WorkspaceStep } from '../state/workspaceStore'
import { FlagsPanel } from './FlagsPanel'
import { HistoryPanel } from './HistoryPanel'
import { SetupInspectorBody } from './SetupInspectorBody'
import { ZonesList } from './ZonesList'

export interface InspectorProps {
  videoId: string
  step: WorkspaceStep
  session: SessionState
  setupEditor: SetupEditor
  sessionActions: SessionActions
  flags: FlagView[]
  history: HistoryEntry[]
  results: Results | null
  onTrack: () => void
  trackDisabled: boolean
}

const STEP_TITLE: Record<WorkspaceStep, string> = {
  setup: 'Setup',
  tracking: 'Tracking',
  review: 'Review & correct',
  results: 'Results'
}

const TABS: readonly { key: InspectorTab; label: string }[] = [
  { key: 'flags', label: 'Flags' },
  { key: 'zones', label: 'Zones' },
  { key: 'history', label: 'History' }
]

/** The 312 px right-hand inspector — header, per-step body, footer (design: `<aside>`). */
export function Inspector({
  videoId,
  step,
  session,
  setupEditor,
  sessionActions,
  flags,
  history,
  results,
  onTrack,
  trackDisabled
}: InspectorProps): React.JSX.Element {
  const navigate = useNavigate()
  const selection = useWorkspaceStore((s) => s.selection)
  const select = useWorkspaceStore((s) => s.select)
  const setSetupTool = useWorkspaceStore((s) => s.setSetupTool)
  const inspectorTab = useWorkspaceStore((s) => s.inspectorTab)
  const setInspectorTab = useWorkspaceStore((s) => s.setInspectorTab)
  const flagFilter = useWorkspaceStore((s) => s.flagFilter)
  const setFlagFilter = useWorkspaceStore((s) => s.setFlagFilter)
  const selectedFlagId = useWorkspaceStore((s) => s.selectedFlagId)
  const selectFlag = useWorkspaceStore((s) => s.selectFlag)
  const currentFrame = useWorkspaceStore((s) => s.currentFrame)
  const seek = useWorkspaceStore((s) => s.seek)
  const speed = useWorkspaceStore((s) => s.speed)
  const correctionsEditor = useCorrectionsEditor(videoId)
  const reopenFlag = useReopenFlag(correctionsEditor)

  const document = session.document
  const setup = document.setup
  const recordedAt = document.video.recorded_at
  const unresolvedCount = countByStatus(flags).unresolved

  const goToStep = (target: WorkspaceStep): void => void navigate(`/videos/${videoId}/${target}`)

  const goToFlag = (flag: FlagView): void => {
    seek(flag.frame_start)
    selectFlag(flag.id)
  }

  const header = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 40,
        px: 1.75,
        pl: 1.75,
        flexShrink: 0
      }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{STEP_TITLE[step]}</Typography>
      {step === 'tracking' ? (
        <Chip
          size="small"
          icon={<Symbol name="lock" size={13} />}
          label="Locked while tracking"
          sx={{ bgcolor: 'surface.raised', color: 'text.secondary', height: 20 }}
        />
      ) : null}
      {step === 'review' ? (
        <Typography variant="mono" sx={{ fontSize: 11.5, color: 'text.disabled' }}>
          {speed}× playback
        </Typography>
      ) : null}
    </Box>
  )

  const tabs =
    step === 'review' ? (
      <Box
        sx={{
          display: 'flex',
          gap: 0.25,
          px: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        {TABS.map((tab) => (
          <Box
            key={tab.key}
            component="button"
            onClick={() => setInspectorTab(tab.key)}
            sx={{
              height: 34,
              px: 1,
              border: 'none',
              borderBottom: '2px solid',
              borderColor: inspectorTab === tab.key ? 'primary.main' : 'transparent',
              mb: '-1px',
              bgcolor: 'transparent',
              color: inspectorTab === tab.key ? 'text.primary' : 'text.secondary',
              font: 'inherit',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer'
            }}
          >
            {tab.label}
            {tab.key === 'flags' && unresolvedCount > 0 ? (
              <Box
                component="span"
                sx={{
                  minWidth: 18,
                  height: 18,
                  boxSizing: 'border-box',
                  px: 0.625,
                  borderRadius: '9px',
                  bgcolor: 'warning.main',
                  color: 'background.default',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: '"IBM Plex Mono", monospace'
                }}
              >
                {unresolvedCount}
              </Box>
            ) : null}
          </Box>
        ))}
      </Box>
    ) : (
      <Divider sx={{ flexShrink: 0 }} />
    )

  let body: React.ReactNode = null
  if (step === 'setup' || step === 'tracking') {
    const locked = step === 'tracking'
    body = (
      <Box sx={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
        <SetupInspectorBody
          videoId={videoId}
          editor={setupEditor}
          selection={selection}
          onSelect={select}
          onEditArena={() => {
            // An arena already exists — select it (Select tool) so its handles show immediately;
            // otherwise switch to the Arena tool to draw one.
            if (setup?.arena) {
              select({ type: 'arena' })
              setSetupTool('select')
            } else {
              setSetupTool('arena')
            }
          }}
          onAddZone={() => setSetupTool('rect')}
          applyTemplate={sessionActions.applyTemplate}
        />
      </Box>
    )
  } else if (step === 'review') {
    if (inspectorTab === 'flags') {
      body = (
        <FlagsPanel
          flags={flags}
          recordedAt={recordedAt ?? null}
          filter={flagFilter}
          onFilterChange={setFlagFilter}
          selectedFlagId={selectedFlagId}
          currentFrame={currentFrame}
          onGoToFlag={goToFlag}
          onReopenFlag={reopenFlag.request}
          onAdjustDetection={() => goToStep('setup')}
        />
      )
    } else if (inspectorTab === 'zones' && setup) {
      body = (
        <ZonesList
          setup={setup}
          editor={setupEditor}
          selectedZoneId={selection?.type === 'zone' ? selection.zoneId : null}
          selectedIsArena={false}
          onSelectZone={(zoneId) => select(zoneId ? { type: 'zone', zoneId } : null)}
          onSelectArena={() => {}}
          onEditArena={() => {}}
          showArena={false}
          infoBanner={
            <Box
              sx={{
                mx: 1.75,
                mt: 1.5,
                display: 'flex',
                gap: 1,
                p: 1.25,
                borderRadius: '8px',
                bgcolor: 'surface.raised',
                fontSize: 12,
                color: 'text.secondary'
              }}
            >
              <Symbol name="info" size={16} sx={{ color: 'text.primary' }} />
              Editing zones recalculates results from the existing track. No re-tracking needed.
            </Box>
          }
        />
      )
    } else {
      body = (
        <HistoryPanel
          entries={history}
          onSelect={(entry) => {
            if (entry.frame_start != null) seek(entry.frame_start)
          }}
        />
      )
    }
  } else if (step === 'results') {
    body = (
      <ResultsInspectorBody
        session={session}
        results={results}
        unresolvedCount={unresolvedCount}
        totalFlags={flags.length}
        onReviewFlags={() => goToStep('review')}
      />
    )
  }

  const footer =
    step === 'setup' ? (
      <Box
        sx={{
          p: 1.75,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          flexShrink: 0
        }}
      >
        <ShortcutTooltip title="Track" shortcut="mod+t">
          <Button
            variant="contained"
            disabled={trackDisabled}
            onClick={onTrack}
            startIcon={<Symbol name="play_circle" size={18} />}
            sx={{ height: 36, fontSize: 13.5, fontWeight: 600 }}
          >
            Track
          </Button>
        </ShortcutTooltip>
        {setup ? (
          <Typography
            variant="mono"
            sx={{ fontSize: 11.5, color: 'text.disabled', textAlign: 'center' }}
          >
            Trial {formatDuration(trialDurationOf(setup, document.video.duration_s))} · about{' '}
            {estimateTrackingSeconds(
              trialDurationOf(setup, document.video.duration_s),
              document.video.nominal_fps
            )}{' '}
            s
          </Typography>
        ) : null}
      </Box>
    ) : step === 'review' ? (
      <Box
        sx={{
          p: '10px 14px',
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.25,
          flexShrink: 0
        }}
      >
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {unresolvedCount > 0
            ? `${unresolvedCount} unresolved flag${unresolvedCount > 1 ? 's' : ''}`
            : 'All flags resolved'}
        </Typography>
        <Button
          variant="contained"
          onClick={() => goToStep('results')}
          endIcon={<Symbol name="arrow_forward" size={17} />}
          sx={{ height: 32, fontWeight: 600 }}
        >
          Results
        </Button>
      </Box>
    ) : null

  return (
    <Box
      component="aside"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider'
      }}
    >
      {header}
      {tabs}
      <Box sx={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>{body}</Box>
      {footer}

      <ConfirmDialog
        open={reopenFlag.pending != null}
        title="Reopen flag"
        description={reopenFlag.description}
        confirmLabel="Reopen"
        onConfirm={reopenFlag.confirm}
        onCancel={reopenFlag.cancel}
      />
    </Box>
  )
}

function trialDurationOf(
  setup: { trial?: { start_s: number; end_s: number } | null },
  videoDurationS: number
): number {
  if (setup.trial) return setup.trial.end_s - setup.trial.start_s
  return videoDurationS
}

interface ResultsInspectorBodyProps {
  session: SessionState
  results: Results | null
  unresolvedCount: number
  totalFlags: number
  onReviewFlags: () => void
}

function ResultsInspectorBody({
  session,
  results,
  unresolvedCount,
  totalFlags,
  onReviewFlags
}: ResultsInspectorBodyProps): React.JSX.Element {
  const document = session.document
  const video = document.video
  const trialInfo = results
    ? [
        {
          key: 'Start',
          value: formatVideoTime(results.trial_start_s),
          clock: null as string | null
        },
        { key: 'End', value: formatVideoTime(results.trial_end_s), clock: null },
        { key: 'Duration', value: formatDuration(results.trial_duration_s), clock: null }
      ]
    : []

  return (
    <Box>
      <Box sx={{ px: 1.75, pt: 1.75, pb: 0.75 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          Trial
        </Typography>
      </Box>
      <Box sx={{ px: 1.75 }}>
        {trialInfo.map((row) => (
          <Box
            key={row.key}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 1.25,
              py: 0.75,
              borderBottom: 1,
              borderColor: 'divider'
            }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{row.key}</Typography>
            <Typography variant="mono" sx={{ fontSize: 12 }}>
              {row.value}
            </Typography>
          </Box>
        ))}
        {video.recorded_at ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 1.25,
              py: 0.75,
              borderBottom: 1,
              borderColor: 'divider'
            }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Recorded</Typography>
            <Typography variant="mono" sx={{ fontSize: 12 }}>
              {formatDate(video.recorded_at)}
            </Typography>
          </Box>
        ) : null}
      </Box>

      <Box sx={{ px: 1.75, pt: 2, pb: 0.75 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          Analysis
        </Typography>
      </Box>
      <Box sx={{ px: 1.75 }}>
        <InfoRow label="Template" value={setupTemplateLabel(document.setup)} />
        {results ? (
          <InfoRow
            label="In-zone threshold"
            value={`${Math.round(results.in_zone_threshold * 100)}% of body`}
          />
        ) : null}
        {document.track_summary ? (
          <InfoRow
            label="Tracked"
            value={new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            }).format(new Date(document.track_summary.tracked_at))}
          />
        ) : null}
        <InfoRow label="Corrections" value={String(document.corrections.length)} />
        <InfoRow
          label="Flags"
          value={`${unresolvedCount} unresolved of ${totalFlags}`}
          color={unresolvedCount > 0 ? 'warning.main' : undefined}
        />
      </Box>

      {unresolvedCount > 0 ? (
        <Box
          sx={{
            m: 1.75,
            display: 'flex',
            gap: 1,
            p: 1.25,
            borderRadius: '8px',
            bgcolor: (t) => `${t.palette.warning.main}26`,
            fontSize: 12
          }}
        >
          <Symbol name="flag" size={17} sx={{ color: 'warning.main', flexShrink: 0 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <span>
              {unresolvedCount} flag{unresolvedCount > 1 ? 's are' : ' is'} still unresolved. You
              can export, but the sheet will note them.
            </span>
            <Box
              component="a"
              onClick={onReviewFlags}
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Review flags
            </Box>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}

function setupTemplateLabel(setup: SessionState['document']['setup']): string {
  return setup.template ? setup.template.name : 'No template applied'
}

function InfoRow({
  label,
  value,
  color
}: {
  label: string
  value: string
  color?: string
}): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 1.25,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, textAlign: 'right', color: color ?? 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  )
}
