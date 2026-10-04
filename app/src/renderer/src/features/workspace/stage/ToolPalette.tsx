import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'

import { Symbol } from '../../../components/Symbol'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import type { UndoRedo } from '../data'
import type { ReviewTool, SetupTool, WorkspaceStep } from '../state/workspaceStore'
import { SHORTCUTS } from '../../../lib/shortcutRegistry'

const SETUP_TOOLS: readonly { tool: SetupTool; icon: string; label: string; shortcut: string }[] = [
  {
    tool: 'select',
    icon: 'arrow_selector_tool',
    label: 'Select / move',
    shortcut: SHORTCUTS.toolSelect.combo
  },
  {
    tool: 'arena',
    icon: 'highlight_alt',
    label: 'Arena outline',
    shortcut: SHORTCUTS.toolArena.combo
  },
  { tool: 'rect', icon: 'rectangle', label: 'Rectangle zone', shortcut: SHORTCUTS.toolRect.combo },
  { tool: 'ellipse', icon: 'circle', label: 'Ellipse zone', shortcut: SHORTCUTS.toolEllipse.combo },
  {
    tool: 'polygon',
    icon: 'pentagon',
    label: 'Polygon zone',
    shortcut: SHORTCUTS.toolPolygon.combo
  },
  {
    tool: 'measure',
    icon: 'straighten',
    label: 'Measure distance',
    shortcut: SHORTCUTS.toolMeasure.combo
  },
  { tool: 'pan', icon: 'pan_tool', label: 'Pan', shortcut: SHORTCUTS.toolPan.combo }
]

const REVIEW_TOOLS: readonly { tool: ReviewTool; icon: string; label: string; shortcut: string }[] =
  [
    {
      tool: 'select',
      icon: 'arrow_selector_tool',
      label: 'Select',
      shortcut: SHORTCUTS.toolSelect.combo
    },
    {
      tool: 'position',
      icon: 'my_location',
      label: 'Set position — click the mouse',
      shortcut: SHORTCUTS.setPosition.combo
    },
    {
      tool: 'hidden',
      icon: 'visibility_off',
      label: 'Mouse not visible',
      shortcut: SHORTCUTS.markNotVisible.combo
    },
    {
      tool: 'fill',
      icon: 'linear_scale',
      label: 'Fill in between',
      shortcut: SHORTCUTS.fillBetween.combo
    },
    { tool: 'pan', icon: 'pan_tool', label: 'Pan', shortcut: SHORTCUTS.toolPan.combo }
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
        <ShortcutTooltip
          key={item.tool}
          title={item.label}
          shortcut={item.shortcut}
          placement="right"
        >
          <span>
            <IconButton
              disabled={isTracking}
              onClick={() =>
                isReview
                  ? onReviewTool(item.tool as ReviewTool)
                  : onSetupTool(item.tool as SetupTool)
              }
              sx={{
                width: 32,
                height: 30,
                borderRadius: 1.5,
                bgcolor: active === item.tool && !isTracking ? 'primary.main' : 'transparent',
                color: isTracking
                  ? 'text.disabled'
                  : active === item.tool
                    ? 'primary.contrastText'
                    : 'text.secondary',
                '&:hover': {
                  bgcolor: active === item.tool && !isTracking ? 'primary.main' : 'action.hover'
                }
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
          <ShortcutTooltip title="Undo" shortcut={SHORTCUTS.undo.combo} placement="right">
            <span>
              <IconButton
                disabled={!undoRedo.canUndo}
                onClick={undoRedo.undo}
                sx={{
                  width: 32,
                  height: 30,
                  borderRadius: 1.5,
                  color: undoRedo.canUndo ? 'text.primary' : 'text.disabled'
                }}
              >
                <Symbol name="undo" size={19} />
              </IconButton>
            </span>
          </ShortcutTooltip>
          <ShortcutTooltip title="Redo" shortcut={SHORTCUTS.redo.combo} placement="right">
            <span>
              <IconButton
                disabled={!undoRedo.canRedo}
                onClick={undoRedo.redo}
                sx={{
                  width: 32,
                  height: 30,
                  borderRadius: 1.5,
                  color: undoRedo.canRedo ? 'text.primary' : 'text.disabled'
                }}
              >
                <Symbol name="redo" size={19} />
              </IconButton>
            </span>
          </ShortcutTooltip>
        </>
      )}

      <Divider sx={{ my: 0.375, mx: 0.25 }} />
      <ShortcutTooltip title="Zoom in" shortcut={SHORTCUTS.zoomIn.combo} placement="right">
        <IconButton
          onClick={onZoomIn}
          sx={{ width: 32, height: 30, borderRadius: 1.5, color: 'text.secondary' }}
        >
          <Symbol name="zoom_in" size={19} />
        </IconButton>
      </ShortcutTooltip>
      <ShortcutTooltip title="Zoom out" shortcut={SHORTCUTS.zoomOut.combo} placement="right">
        <IconButton
          onClick={onZoomOut}
          sx={{ width: 32, height: 30, borderRadius: 1.5, color: 'text.secondary' }}
        >
          <Symbol name="zoom_out" size={19} />
        </IconButton>
      </ShortcutTooltip>
      <ShortcutTooltip title="Fit to window" shortcut={SHORTCUTS.zoomFit.combo} placement="right">
        <IconButton
          onClick={onZoomFit}
          sx={{ width: 32, height: 30, borderRadius: 1.5, color: 'text.secondary' }}
        >
          <Symbol name="fit_screen" size={19} />
        </IconButton>
      </ShortcutTooltip>
    </Box>
  )
}
