import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import type { VideoInfo } from '../../../api/types'
import { formatDate } from '../../../lib/time'
import type { SaveLabelInfo } from '../lib/session'
import type { WorkspaceStep } from '../state/workspaceStore'
import { BatchNav, type BatchNavProps } from './BatchNav'
import { Breadcrumb } from './Breadcrumb'
import { SaveControl } from './SaveControl'
import { StepTabs } from './StepTabs'

export interface WorkspaceTopBarProps {
  videoPath: string
  fileName: string
  recordedAt: VideoInfo['recorded_at']
  step: WorkspaceStep
  disabledAfterSetup: boolean
  onSelectStep: (step: WorkspaceStep) => void
  save: SaveLabelInfo
  onSave: () => void
  saving: boolean
  /** Shown instead of the recorded-time readout while `?batch=` is in the URL. */
  batchNav?: BatchNavProps
}

/** The 48 px top bar: breadcrumb, workflow steps, recorded time, and save state. */
export function WorkspaceTopBar({
  videoPath,
  fileName,
  recordedAt,
  step,
  disabledAfterSetup,
  onSelectStep,
  save,
  onSave,
  saving,
  batchNav
}: WorkspaceTopBarProps): React.JSX.Element {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        height: 48,
        minHeight: 48,
        px: '10px',
        pl: '14px',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        minWidth: 0
      }}
    >
      <Breadcrumb videoPath={videoPath} fileName={fileName} />
      <StepTabs step={step} disabledAfterSetup={disabledAfterSetup} onSelect={onSelectStep} />
      {batchNav ? <BatchNav {...batchNav} /> : null}
      <Box
        sx={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1.5
        }}
      >
        {recordedAt ? (
          <Box
            title="Recording start, read from the video file"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              minWidth: 0,
              overflow: 'hidden',
              lineHeight: 1.2
            }}
          >
            <Typography sx={{ fontSize: 10.5, color: 'text.disabled', whiteSpace: 'nowrap' }}>
              Recorded
            </Typography>
            <Typography
              variant="mono"
              sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
              {formatDate(recordedAt)}{' '}
              {new Intl.DateTimeFormat(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).format(new Date(recordedAt))}
            </Typography>
          </Box>
        ) : null}
        <SaveControl info={save} onSave={onSave} saving={saving} />
      </Box>
    </Box>
  )
}
