import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import { alpha } from '@mui/material/styles'

import { Symbol } from '../../../components/Symbol'
import type { Zone } from '../../../api/types'

export interface ZoneRowProps {
  zone: Zone
  color: string
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onToggleVisible: () => void
  onToggleLocked: () => void
  onDelete: () => void
}

/** One draggable, inline-renamable row of the Setup/Review zones list. */
export function ZoneRow({
  zone,
  color,
  selected,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onDelete
}: ZoneRowProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: zone.id
  })

  // Uncontrolled: `zone.name` renames only ever come from this input's own commit, so there is
  // no external value to resync against, and an uncontrolled field keeps typing free of re-renders.
  const commitName = (value: string): void => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== zone.name) onRename(trimmed)
  }

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      sx={[
        {
          display: 'grid',
          gridTemplateColumns: '14px 12px minmax(0,1fr) auto',
          alignItems: 'center',
          gap: 1,
          height: 32,
          px: 0.25,
          borderRadius: '6px',
          cursor: 'pointer',
          opacity: isDragging ? 0.5 : 1
        },
        selected ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.13) } : {}
      ]}
    >
      <Box
        component="span"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        sx={{
          display: 'flex',
          color: 'text.disabled',
          cursor: 'grab',
          touchAction: 'none'
        }}
      >
        <Symbol name="drag_indicator" size={15} />
      </Box>
      <Box
        component="span"
        sx={{
          width: 12,
          height: 12,
          boxSizing: 'border-box',
          borderRadius: '3px',
          border: `1.5px solid ${color}`,
          bgcolor: alpha(color, 0.25)
        }}
      />
      <InputBase
        key={zone.name}
        defaultValue={zone.name}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => commitName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.currentTarget.value = zone.name
            e.currentTarget.blur()
          }
        }}
        sx={{
          minWidth: 0,
          color: zone.visible ? 'text.primary' : 'text.disabled',
          fontSize: 13,
          '& input': { p: '3px 4px' }
        }}
      />
      <Box sx={{ display: 'flex' }}>
        <IconButton
          title="Show / hide"
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisible()
          }}
          sx={{ color: zone.visible ? 'text.secondary' : 'text.disabled', width: 24, height: 24 }}
        >
          <Symbol name={zone.visible ? 'visibility' : 'visibility_off'} size={16} />
        </IconButton>
        <IconButton
          title="Lock"
          onClick={(e) => {
            e.stopPropagation()
            onToggleLocked()
          }}
          sx={{ color: zone.locked ? 'text.primary' : 'text.disabled', width: 24, height: 24 }}
        >
          <Symbol name={zone.locked ? 'lock' : 'lock_open'} size={16} />
        </IconButton>
        <IconButton
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          sx={{ color: 'text.disabled', width: 24, height: 24, '&:hover': { color: 'error.main' } }}
        >
          <Symbol name="delete" size={16} />
        </IconButton>
      </Box>
    </Box>
  )
}
