import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'

import type { SessionActions, SetupEditor } from '../data'
import type { StageSelection } from '../state/workspaceStore'
import { DetectionSection } from './DetectionSection'
import { ImageAdjustmentsSection } from './ImageAdjustmentsSection'
import { ScaleSection } from './ScaleSection'
import { TemplateSection } from './TemplateSection'
import { ZonesList } from './ZonesList'

export interface SetupInspectorBodyProps {
  videoId: string
  editor: SetupEditor
  selection: StageSelection
  onSelect: (selection: StageSelection) => void
  onEditArena: () => void
  onAddZone: () => void
  applyTemplate: SessionActions['applyTemplate']
}

/** Arena/zones, image, detection and template sections — shared by Setup and (locked) Tracking. */
export function SetupInspectorBody({
  videoId,
  editor,
  selection,
  onSelect,
  onEditArena,
  onAddZone,
  applyTemplate
}: SetupInspectorBodyProps): React.JSX.Element | null {
  const setup = editor.setup
  if (!setup) return null

  return (
    <Box>
      <ZonesList
        setup={setup}
        editor={editor}
        selectedZoneId={selection?.type === 'zone' ? selection.zoneId : null}
        selectedIsArena={selection?.type === 'arena'}
        onSelectZone={(zoneId) => onSelect(zoneId ? { type: 'zone', zoneId } : null)}
        onSelectArena={() => onSelect({ type: 'arena' })}
        onEditArena={onEditArena}
        onAddZone={onAddZone}
      />
      <Divider sx={{ mt: 1.5 }} />
      <ScaleSection setup={setup} editor={editor} />
      <Divider />
      <ImageAdjustmentsSection setup={setup} editor={editor} />
      <Divider sx={{ mt: 1.75 }} />
      <DetectionSection setup={setup} editor={editor} />
      <Divider sx={{ mt: 1.75 }} />
      <TemplateSection videoId={videoId} setup={setup} applyTemplate={applyTemplate} />
    </Box>
  )
}
