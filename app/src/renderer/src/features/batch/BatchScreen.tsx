import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useNavigate, useSearchParams } from 'react-router'

import {
  useBatches,
  useCancelJob,
  useCheckBatch,
  useCreateBatch,
  useDeleteBatch,
  useJobs,
  useLibrary,
  useSettings,
  useSystemInfo,
  useTemplates
} from '../../api/queries'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ExportDialog, useExportDialog } from '../export'
import { formatClockTime, formatDate } from '../../lib/time'
import { useCurrentFolderStore } from '../../stores/currentFolder'
import { notify, notifyError } from '../../stores/notifications'
import { BatchFooter } from './BatchFooter'
import { BatchStepper } from './BatchStepper'
import { ChooseStep } from './ChooseStep'
import { CheckStep } from './CheckStep'
import { FinishStep } from './FinishStep'
import { RunStep } from './RunStep'
import { allTerminal, buildCheckDraft, deviceLabel, type BatchStep, type CheckDraft } from './lib'
import { useBatchStore } from './state/batchStore'

/** The Batch screen: Choose → Check → Run → Finish — `designs/Screens.dc.html` §isBatch.
 *
 * Batches are persisted by the engine, so opening `/batch` reopens the most recently saved one
 * (Run while any of its jobs are still going, otherwise Finish) instead of starting empty. */
export function BatchScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const folderPath = useCurrentFolderStore((state) => state.path)
  const folderName = useCurrentFolderStore((state) => state.name)

  const library = useLibrary(folderPath ?? undefined)
  const templatesQuery = useTemplates()
  const settingsQuery = useSettings()
  const systemQuery = useSystemInfo()
  const jobsQuery = useJobs()
  const batchesQuery = useBatches()
  const cancelJob = useCancelJob()
  const checkBatch = useCheckBatch()
  const createBatch = useCreateBatch()
  const deleteBatch = useDeleteBatch()
  const exportDialog = useExportDialog()

  const selectedBatchId = useBatchStore((state) => state.selectedBatchId)
  const startingNew = useBatchStore((state) => state.startingNew)
  const selectBatch = useBatchStore((state) => state.selectBatch)
  const startNewBatch = useBatchStore((state) => state.startNewBatch)

  const [localStep, setLocalStep] = useState<'choose' | 'check'>('choose')
  // `null` means "no explicit choice yet" — the video list and template fall back to a computed
  // default below. This is a pure per-render derivation (no effect) so it never fights the user:
  // once they touch either selection, the state holds their exact choice from then on.
  const [selectedVideoIdsState, setSelectedVideoIdsState] = useState<string[] | null>(() => {
    const param = searchParams.get('videos')
    return param ? param.split(',').filter(Boolean) : null
  })
  const [selectedTemplateIdState, setSelectedTemplateIdState] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<CheckDraft[] | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const templates = templatesQuery.data ?? []
  const savedBatches = batchesQuery.data?.batches ?? []
  const brokenBatches = batchesQuery.data?.broken ?? []
  const mostRecentBatchId = savedBatches[0]?.id ?? null
  const activeBatchId = selectedBatchId ?? mostRecentBatchId
  const activeBatch = activeBatchId
    ? (savedBatches.find((b) => b.id === activeBatchId) ?? null)
    : null

  const defaultVideoIds = useMemo(
    () =>
      (library.data?.videos ?? [])
        .filter((v) => v.status === 'new' || v.status === 'set_up')
        .map((v) => v.id),
    [library.data]
  )
  const selectedVideoIds = selectedVideoIdsState ?? defaultVideoIds
  const setSelectedVideoIds = (ids: string[]): void => setSelectedVideoIdsState(ids)

  const selectedTemplateId = selectedTemplateIdState ?? templates[0]?.id ?? null
  const setSelectedTemplateId = (id: string): void => setSelectedTemplateIdState(id)

  const jobs = useMemo(
    () => (jobsQuery.data ?? []).filter((job) => job.batch_id === activeBatchId),
    [jobsQuery.data, activeBatchId]
  )
  const batchDone = activeBatchId !== null && allTerminal(jobs)
  const showingExisting = !startingNew && activeBatch !== null
  const step: BatchStep = showingExisting ? (batchDone ? 'finish' : 'run') : localStep

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null

  const goToCheck = (): void => {
    if (!selectedTemplateId || selectedVideoIds.length === 0) return
    checkBatch.mutate(
      { template_id: selectedTemplateId, video_ids: selectedVideoIds },
      {
        onSuccess: (items) => {
          setDrafts(items.map(buildCheckDraft))
          setLocalStep('check')
        },
        onError: (error) => notifyError('Could not check these videos', error)
      }
    )
  }

  const backToChoose = (): void => {
    setDrafts(null)
    setLocalStep('choose')
  }

  const updateDraft = (videoId: string, patch: Partial<CheckDraft>): void => {
    setDrafts(
      (current) => current?.map((d) => (d.videoId === videoId ? { ...d, ...patch } : d)) ?? current
    )
  }

  const trackNow = (): void => {
    if (!drafts || !selectedTemplateId) return
    const items = drafts
      .filter((d) => d.included)
      .map((d) => ({
        video_id: d.videoId,
        trial: [d.trialStart, d.trialEnd] as [number, number],
        offset_x: d.offsetX,
        offset_y: d.offsetY
      }))
    if (items.length === 0) return
    createBatch.mutate(
      { template_id: selectedTemplateId, items },
      {
        onSuccess: (batch) => {
          selectBatch(batch.id)
          setDrafts(null)
          setLocalStep('choose')
        },
        onError: (error) => notifyError('Could not start tracking', error)
      }
    )
  }

  const startNewBatchClick = (): void => {
    startNewBatch()
    setLocalStep('choose')
    setSelectedVideoIdsState(null)
    setDrafts(null)
  }

  const resetBatch = (targetId: string): void => {
    deleteBatch.mutate(targetId, {
      onSuccess: () => {
        notify({ severity: 'success', title: 'Batch removed from the list' })
        startNewBatchClick()
      },
      onError: (error) => notifyError('Could not reset this batch', error)
    })
    setConfirmingReset(false)
  }

  const cancelAllJobs = (): void => {
    for (const job of jobs) {
      if (job.state === 'queued' || job.state === 'running') cancelJob.mutate(job.id)
    }
  }

  const openExportAll = (): void => {
    const succeededIds = jobs.filter((j) => j.state === 'succeeded').map((j) => j.video_id)
    const reviewableIds =
      succeededIds.length > 0
        ? succeededIds
        : (activeBatch?.items ?? [])
            .filter((item) => item.status === 'tracked' || item.status === 'reviewed')
            .map((item) => item.video_id)
    if (reviewableIds.length === 0) return
    exportDialog.open({
      videoIds: reviewableIds,
      getDefaultPath: (format) => `batch-results.${format}`
    })
  }

  const includedCount = drafts?.filter((d) => d.included).length ?? 0
  const warningCount = drafts?.filter((d) => d.warnings.length > 0).length ?? 0

  let footerText: string
  let onBack: (() => void) | undefined
  let nextLabel: string | undefined
  let onNext: (() => void) | undefined
  let nextDisabled = false

  if (step === 'choose') {
    footerText = `${selectedVideoIds.length} ${selectedVideoIds.length === 1 ? 'video' : 'videos'}${
      selectedTemplate ? ` · ${selectedTemplate.name}` : ''
    }`
    nextLabel = 'Next: Check'
    onNext = goToCheck
    nextDisabled = selectedVideoIds.length === 0 || !selectedTemplateId || checkBatch.isPending
  } else if (step === 'check') {
    footerText = `${includedCount} of ${drafts?.length ?? 0} videos included${
      warningCount > 0 ? ` · ${warningCount} warnings` : ''
    }`
    onBack = backToChoose
    nextLabel = `Track ${includedCount} ${includedCount === 1 ? 'video' : 'videos'}`
    onNext = trackNow
    nextDisabled = includedCount === 0 || createBatch.isPending
  } else if (step === 'run') {
    footerText = 'Tracking continues if you leave this page.'
  } else {
    const finishedAt = jobs.reduce<string | null>((latest, job) => {
      if (!job.finished_at) return latest
      return !latest || job.finished_at > latest ? job.finished_at : latest
    }, null)
    footerText = finishedAt
      ? `Finished ${formatDate(finishedAt)} ${formatClockTime(finishedAt, 0)}`
      : ''
  }

  const resetTarget = showingExisting ? activeBatchId : (brokenBatches[0]?.id ?? null)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          height: 60,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flex: 'none',
          minWidth: 0
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 0' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Batch</Typography>
          <Typography variant="caption" color="text.disabled" noWrap>
            {folderName ?? ''}
          </Typography>
        </Box>
        <BatchStepper step={step} />
        <Box
          sx={{
            flex: '1 1 0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1
          }}
        >
          {resetTarget ? (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setConfirmingReset(true)}
              sx={{ height: 28, px: 1.5, fontSize: 12.5 }}
            >
              Reset batch
            </Button>
          ) : null}
          {step === 'finish' ? (
            <Button
              variant="outlined"
              onClick={startNewBatchClick}
              sx={{ height: 28, px: 1.5, fontSize: 12.5 }}
            >
              Start a new batch
            </Button>
          ) : null}
        </Box>
      </Box>

      {!folderPath ? (
        <EmptyState
          icon="stacks"
          title="No folder open"
          description="Open a library folder first, then come back to choose videos for a batch."
          action={
            <Button variant="contained" onClick={() => void navigate('/')}>
              Go to Start
            </Button>
          }
        />
      ) : step === 'choose' &&
        !showingExisting &&
        brokenBatches.length > 0 &&
        savedBatches.length === 0 ? (
        <EmptyState
          icon="error"
          title="A saved batch couldn't be read"
          description={`${brokenBatches[0]!.id}: ${brokenBatches[0]!.error}`}
          action={
            <Button variant="outlined" color="error" onClick={() => setConfirmingReset(true)}>
              Reset it
            </Button>
          }
        />
      ) : step === 'choose' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          {brokenBatches.length > 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: (theme) => `${theme.palette.warning.main}1a`,
                fontSize: 12.5
              }}
            >
              <span>
                {brokenBatches.length} saved {brokenBatches.length === 1 ? 'batch' : 'batches'}{' '}
                couldn't be read.
              </span>
              <Button
                variant="text"
                size="small"
                color="warning"
                onClick={() => setConfirmingReset(true)}
                sx={{ minWidth: 0, fontSize: 12.5 }}
              >
                Reset {brokenBatches[0]!.id}
              </Button>
            </Box>
          ) : null}
          {library.isLoading ? (
            <CenteredSpinner />
          ) : library.isError ? (
            <EmptyState
              icon="error"
              title="Couldn't load this folder"
              description={library.error instanceof Error ? library.error.message : undefined}
            />
          ) : (
            <ChooseStep
              videos={library.data?.videos ?? []}
              selectedVideoIds={selectedVideoIds}
              onChangeSelected={setSelectedVideoIds}
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onChangeTemplate={setSelectedTemplateId}
            />
          )}
        </Box>
      ) : step === 'check' ? (
        drafts ? (
          <CheckStep
            drafts={drafts}
            onChangeDraft={updateDraft}
            arena={selectedTemplate?.arena}
            zones={selectedTemplate?.zones ?? []}
            trialDurationS={selectedTemplate?.trial_duration_s ?? null}
          />
        ) : (
          <CenteredSpinner />
        )
      ) : step === 'run' ? (
        <RunStep
          jobs={jobs}
          deviceLabel={deviceLabel(
            settingsQuery.data?.device ?? 'auto',
            systemQuery.data?.gpu?.name
          )}
          parallelJobs={settingsQuery.data?.parallel_jobs ?? 1}
          onCancelAll={cancelAllJobs}
          onCancelJob={(jobId) => cancelJob.mutate(jobId)}
        />
      ) : activeBatch ? (
        <FinishStep
          batchId={activeBatch.id}
          items={activeBatch.items}
          onExportAll={openExportAll}
        />
      ) : (
        <CenteredSpinner />
      )}

      {folderPath && (step === 'choose' || step === 'check') ? (
        <BatchFooter
          text={footerText}
          onBack={onBack}
          nextLabel={nextLabel}
          onNext={onNext}
          nextDisabled={nextDisabled}
        />
      ) : folderPath ? (
        <BatchFooter text={footerText} />
      ) : null}

      <ConfirmDialog
        open={confirmingReset}
        title="Reset this batch?"
        description="Removes this batch from the list. Tracking results and analysis files are kept."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          if (resetTarget) resetBatch(resetTarget)
        }}
        onCancel={() => setConfirmingReset(false)}
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

function CenteredSpinner(): React.JSX.Element {
  return (
    <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={28} />
    </Box>
  )
}
