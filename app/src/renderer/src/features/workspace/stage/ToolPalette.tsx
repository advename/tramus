import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'

import { Symbol } from '../../../components/Symbol'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import type { UndoRedo } from '../data'
import type { ReviewTool, SetupTool, WorkspaceStep } from '../state/workspaceStore'

const SETUP_TOOLS: readonly { tool: SetupTool; icon: string; label: string; key: string }[] = [
  { tool: 'select', icon: 'arrow_selector_tool', label: 'Select / move', key: 'V' },
  { tool: 'arena', icon: 'highlight_alt', label: 'Arena outline', key: 'A' },
  { tool: 'rect', icon: 'rectangle', label: 'Rectangle zone', key: 'R' },
  { tool: 'ellipse', icon: 'circle', label: 'Ellipse zone', key: 'E' },
  { tool: 'polygon', icon: 'pentagon', label: 'Polygon zone', key: 'G' },
  { tool: 'pan', icon: 'pan_tool', label: 'Pan', key: 'H' }
]

const REVIEW_TOOLS: readonly { tool: ReviewTool; icon: string; label: string; key: string }[] = [
  { tool: 'select', icon: 'arrow_selector_tool', label: 'Select', key: 'V' },
  { tool: 'position', icon: 'my_location', label: 'Set position — click the mouse', key: 'P' },
  { tool: 'hidden', icon: 'visibility_off', label: 'Mouse not visible', key: 'N' },
  { tool: 'fill', icon: 'linear_scale', label: 'Fill in between', key: 'F' },
  { tool: 'pan', icon: 'pan_tool', label: 'Pan', key: 'H' }
]

export interface ToolPaletteProps {
  step: WorkspaceStep
  setupTool: SetupTool
  reviewTool: ReviewTool
  onSetupTool: (tool: SetupTool) => void
  onReviewTool: (tool: ReviewTool) => void
  undoRedo?: UndoRedo
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
}

/**
 * The floating vertical tool palette (top-left of the stage): the step's tools, then in Review
 * undo/redo, then zoom controls — per `designs/Workspace.dc.html`.
 */
export function ToolPalette({
  step,
  setupTool,
  reviewTool,
  onSetupTool,
  onReviewTool,
  undoRedo,
  onZoomIn,
  onZoomOut,
  onZoomFit
}: ToolPaletteProps): React.JSX.Element {
  const isReview = step === 'review'
  const isTracking = step === 'tracking'
  const items = isReview ? REVIEW_TOOLS : SETUP_TOOLS
  const active = isReview ? reviewTool : setupTool

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 10,
        top: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        p: 0.5,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2.25
      }}
    >
      {items.map((item) => (
        <ShortcutTooltip key={item.tool} title={item.label} shortcut={item.key.toLowerCase()} placement="right">
          <span>
            <IconButton
              disabled={isTracking}
              onClick={() =>
                isReview ? onReviewTool(item.tool as ReviewTool) : onSetupTool(item.tool as SetupTool)
              }
              sx={{
                width: 32,
                height: 30,
                borderRadius: 1.5,
                bgcolor: active === item.tool && !isTracking ? 'primary.main' : 'transparent',
                color: isTracking ? 'text.disabled' : active === item.tool ? 'primary.contrastText' : 'text.secondary',
                '&:hover': { bgcolor: active === item.tool && !isTracking ? 'primary.main' : 'action.hover' }
              }}
            >
              <Symbol name={item.icon} size={19} />
            </IconButton>
          </span>
        </ShortcutTooltip>
      ))}

      {isReview && undoRedo && (
        <>
          <Divider sx={{ my: 0.375, mx: 0.25 }} />
          <ShortcutTooltip title="Undo" shortcut="mod+z" placement="right">
            <span>
              <IconButton
                disabled={!undoRedo.canUndo}
                onClick={undoRedo.undo}
                sx={{ width: 32, height: 30, borderRadius: 1.5, color: undoRedo.canUndo ? 'text.primary' : 'text.disabled' }}
              >
                <Symbol name="undo" size={19} />
              </IconButton>
            </span>
          </ShortcutTooltip>
          <ShortcutTooltip title="Redo" shortcut="mod+shift+z" placement="right">
            <span>
              <IconButton
                disabled={!undoRedo.canRedo}
                onClick={undoRedo.redo}
                sx={{ width: 32, height: 30, borderRadius: 1.5, color: undoRedo.canRedo ? 'text.primary' : 'text.disabled' }}
              >
                <Symbol name="redo" size={19} />
              </IconButton>
            </span>
          </ShortcutTooltip>
        </>
      )}

      <Divider sx={{ my: 0.375, mx: 0.25 }} />
      <ShortcutTooltip title="Zoom in" shortcut="mod+=" placement="right">
        <IconButton onClick={onZoomIn} sx={{ width: 32, height: 30, borderRadius: 1.5, color: 'text.secondary' }}>
          <Symbol name="zoom_in" size={19} />
        </IconButton>
      </ShortcutTooltip>
      <ShortcutTooltip title="Zoom out" shortcut="mod+-" placement="right">
        <IconButton onClick={onZoomOut} sx={{ width: 32, height: 30, borderRadius: 1.5, color: 'text.secondary' }}>
          <Symbol name="zoom_out" size={19} />
        </IconButton>
      </ShortcutTooltip>
      <ShortcutTooltip title="Fit to window" shortcut="mod+0" placement="right">
        <IconButton onClick={onZoomFit} sx={{ width: 32, height: 30, borderRadius: 1.5, color: 'text.secondary' }}>
          <Symbol name="fit_screen" size={19} />
        </IconButton>
      </ShortcutTooltip>
    </Box>
  )
}
