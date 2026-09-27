import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

import { Symbol } from '../../../components/Symbol'
import type { StageView } from '../state/workspaceStore'

export interface ViewToggleProps {
  view: StageView
  onChange: (view: StageView) => void
}

/** "Video / What the tracker sees" toggle, shown in Setup and Tracking (top-right of the stage). */
export function ViewToggle({ view, onChange }: ViewToggleProps): React.JSX.Element {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 10,
        right: 12,
        display: 'flex',
        gap: 0.25,
        p: 0.5,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2.25
      }}
    >
      <Button
        title="Video · B"
        onClick={() => onChange('video')}
        startIcon={<Symbol name="videocam" size={16} />}
        sx={{
          height: 28,
          px: 1.25,
          bgcolor: view === 'video' ? 'surface.raised' : 'transparent',
          color: view === 'video' ? 'text.primary' : 'text.secondary'
        }}
      >
        Video
      </Button>
      <Button
        title="What the tracker sees · B"
        onClick={() => onChange('tracker')}
        startIcon={<Symbol name="contrast" size={16} />}
        sx={{
          height: 28,
          px: 1.25,
          whiteSpace: 'nowrap',
          bgcolor: view === 'tracker' ? 'surface.raised' : 'transparent',
          color: view === 'tracker' ? 'text.primary' : 'text.secondary'
        }}
      >
        What the tracker sees
      </Button>
    </Box>
  )
}
