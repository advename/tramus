import type { ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import type { SetupEditor } from '../data'
import type { Setup } from '../../../api/types'
import { ShortcutTooltip } from '../../../components/ShortcutTooltip'
import { Symbol } from '../../../components/Symbol'
import { describeShape } from '../lib/shapes'
import { nextBulkToggle } from '../lib/zones'
import { SelectedZonePanel } from './SelectedZonePanel'
import { ZoneRow } from './ZoneRow'

export interface ZonesListProps {
  setup: Setup
  editor: SetupEditor
  selectedZoneId: string | null
  selectedIsArena: boolean
  onSelectZone: (zoneId: string | null) => void
  onSelectArena: () => void
  onEditArena: () => void
  onAddZone?: () => void
  /** Shown above the arena row, e.g. Review's "editing zones recalculates results" note. */
  infoBanner?: ReactNode
  /** Setup/Tracking show the arena row too; Review's Zones tab shows zones only. */
  showArena?: boolean
}

/** Arena row + reorderable zones list + selected zone's properties (design: `showZonesList`). */
export function ZonesList({
  setup,
  editor,
  selectedZoneId,
  selectedIsArena,
  onSelectZone,
  onSelectArena,
  onEditArena,
  onAddZone,
  infoBanner,
  showArena = true
}: ZonesListProps): React.JSX.Element {
  const theme = useTheme()
  const zones = setup.zones ?? []
  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const commitZones = (nextZones: typeof zones, label: string): void => {
    void editor.commit({ ...setup, zones: nextZones }, label)
  }

  // "Next" value to assign to every zone's `visible`/`locked` flag: off if any zone currently has
  // it on, else on — see `nextBulkToggle`.
  const nextVisible = nextBulkToggle(zones, 'visible')
  const nextLocked = nextBulkToggle(zones, 'locked')

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = zones.findIndex((z) => z.id === active.id)
    const to = zones.findIndex((z) => z.id === over.id)
    if (from === -1 || to === -1) return
    commitZones(arrayMove(zones, from, to), 'Reorder zones')
  }

  return (
    <>
      {infoBanner}

      {showArena ? (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.75,
              pt: 1.75,
              pb: 0.75
            }}
          >
            <Typography variant="overline" sx={{ color: 'text.disabled' }}>
              Arena
            </Typography>
          </Box>
          <Box
            onClick={onSelectArena}
            sx={{
              mx: 1,
              display: 'grid',
              gridTemplateColumns: '18px minmax(0,1fr) auto',
              gap: 1,
              alignItems: 'center',
              height: 32,
              px: 0.75,
              borderRadius: '6px',
              cursor: 'pointer',
              bgcolor: selectedIsArena ? 'surface.raised' : 'transparent'
            }}
          >
            <Symbol name="highlight_alt" size={17} sx={{ color: 'text.secondary' }} />
            <Typography
              sx={{
                color: setup.arena ? 'text.primary' : 'text.disabled',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 13
              }}
            >
              {setup.arena ? describeShape(setup.arena) : 'Not drawn yet'}
            </Typography>
            <ShortcutTooltip title="Edit arena outline" shortcut="a">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  onEditArena()
                }}
                sx={{ color: 'text.secondary', width: 26, height: 26 }}
              >
                <Symbol name="edit" size={16} />
              </IconButton>
            </ShortcutTooltip>
          </Box>
        </>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.75,
          pt: 1.75,
          pb: 0.75
        }}
      >
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          Zones · {zones.length}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <IconButton
            title={nextVisible ? 'Show all zones' : 'Hide all zones'}
            disabled={zones.length === 0}
            onClick={() =>
              commitZones(
                zones.map((z) => ({ ...z, visible: nextVisible })),
                nextVisible ? 'Show all zones' : 'Hide all zones'
              )
            }
            sx={{ color: 'text.secondary', width: 24, height: 24 }}
          >
            <Symbol name={nextVisible ? 'visibility_off' : 'visibility'} size={16} />
          </IconButton>
          <IconButton
            title={nextLocked ? 'Lock all zones' : 'Unlock all zones'}
            disabled={zones.length === 0}
            onClick={() =>
              commitZones(
                zones.map((z) => ({ ...z, locked: nextLocked })),
                nextLocked ? 'Lock all zones' : 'Unlock all zones'
              )
            }
            sx={{ color: 'text.secondary', width: 24, height: 24 }}
          >
            <Symbol name={nextLocked ? 'lock_open' : 'lock'} size={16} />
          </IconButton>
          {onAddZone ? (
            <ShortcutTooltip title="Add zone" shortcut="r">
              <ButtonBase
                onClick={onAddZone}
                sx={{
                  height: 24,
                  pl: 0.5,
                  pr: 1,
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  fontSize: 12,
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'surface.hover', color: 'text.primary' }
                }}
              >
                <Symbol name="add" size={16} />
                Add
              </ButtonBase>
            </ShortcutTooltip>
          ) : null}
        </Box>
      </Box>

      {zones.length === 0 ? (
        <Box
          sx={{
            mx: 1.75,
            mb: 1,
            p: 1.75,
            border: '1px dashed',
            borderColor: 'surface.lineStrong',
            borderRadius: '8px',
            color: 'text.disabled',
            fontSize: 12,
            textAlign: 'center'
          }}
        >
          No zones yet. Draw one on the video.
        </Box>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={zones.map((z) => z.id)} strategy={verticalListSortingStrategy}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1px', px: 1 }}>
              {zones.map((zone) => (
                <ZoneRow
                  key={zone.id}
                  zone={zone}
                  color={theme.palette.zones[zone.color_index] ?? theme.palette.text.secondary}
                  selected={zone.id === selectedZoneId}
                  onSelect={() => onSelectZone(zone.id)}
                  onRename={(name) =>
                    commitZones(
                      zones.map((z) => (z.id === zone.id ? { ...z, name } : z)),
                      `Rename zone “${zone.name}”`
                    )
                  }
                  onToggleVisible={() =>
                    commitZones(
                      zones.map((z) => (z.id === zone.id ? { ...z, visible: !z.visible } : z)),
                      zone.visible ? `Hide zone “${zone.name}”` : `Show zone “${zone.name}”`
                    )
                  }
                  onToggleLocked={() =>
                    commitZones(
                      zones.map((z) => (z.id === zone.id ? { ...z, locked: !z.locked } : z)),
                      zone.locked ? `Unlock zone “${zone.name}”` : `Lock zone “${zone.name}”`
                    )
                  }
                  onDelete={() => {
                    if (zone.id === selectedZoneId) onSelectZone(null)
                    commitZones(
                      zones.filter((z) => z.id !== zone.id),
                      `Delete zone “${zone.name}”`
                    )
                  }}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      )}

      {selectedZone ? (
        <SelectedZonePanel
          zone={selectedZone}
          onColorChange={(colorIndex) =>
            commitZones(
              zones.map((z) => (z.id === selectedZone.id ? { ...z, color_index: colorIndex } : z)),
              `Recolour zone “${selectedZone.name}”`
            )
          }
        />
      ) : null}
    </>
  )
}
