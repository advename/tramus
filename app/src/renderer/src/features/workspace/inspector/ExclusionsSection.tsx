import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'

import type { Exclusion, Setup } from '../../../api/types'
import { Symbol } from '../../../components/Symbol'
import { formatDuration, formatVideoTime } from '../../../lib/time'
import type { SetupEditor } from '../data'
import { exclusionsTotalS } from '../lib/exclusions'
import { frameAtTime } from '../lib/frames'
import { useVideoTiming } from '../playback/useVideoTiming'
import { useWorkspaceStore } from '../state/workspaceStore'

export interface ExclusionsSectionProps {
  videoId: string
  setup: Setup
  editor: SetupEditor
}

/**
 * The Setup inspector's "Excluded periods" list (design: placed after Scale). Periods are created
 * on the timeline (Shift+drag, then Exclude — `X`, see `timeline/RangePopover.tsx`); this section
 * renames, deletes and seeks to them. See `docs/architecture.md` §4, §5.5.
 */
export function ExclusionsSection({
  videoId,
  setup,
  editor
}: ExclusionsSectionProps): React.JSX.Element {
  const frameTimes = useVideoTiming(videoId)
  const seek = useWorkspaceStore((s) => s.seek)
  const pause = useWorkspaceStore((s) => s.pause)
  const selectedExclusionId = useWorkspaceStore((s) => s.selectedExclusionId)
  const selectExclusion = useWorkspaceStore((s) => s.selectExclusion)

  const exclusions = [...(setup.exclusions ?? [])].sort((a, b) => a.start_s - b.start_s)
  const totalS = exclusionsTotalS(exclusions)

  const commitExclusions = (next: Exclusion[], label: string): void => {
    void editor.commit({ ...setup, exclusions: next }, label)
  }

  const handleSelect = (exclusion: Exclusion): void => {
    if (frameTimes) {
      pause()
      seek(frameAtTime(frameTimes, exclusion.start_s))
    }
    selectExclusion(exclusion.id)
  }

  return (
    <Box>
      <Box sx={{ px: 1.75, pt: 1.75, pb: 0.75 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          Excluded periods{exclusions.length > 0 ? ` · ${exclusions.length}` : ''}
        </Typography>
      </Box>

      {exclusions.length === 0 ? (
        <Box sx={{ px: 1.75, pb: 1.75 }}>
          <Box
            sx={{
              p: 1.75,
              border: '1px dashed',
              borderColor: 'surface.lineStrong',
              borderRadius: '8px',
              color: 'text.disabled',
              fontSize: 12,
              textAlign: 'center'
            }}
          >
            Shift+drag on the timeline, then Exclude (X).
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1px', px: 1 }}>
            {exclusions.map((exclusion) => (
              <ExclusionRow
                key={exclusion.id}
                exclusion={exclusion}
                selected={exclusion.id === selectedExclusionId}
                onSelect={() => handleSelect(exclusion)}
                onRenote={(note) =>
                  commitExclusions(
                    exclusions.map((e) => (e.id === exclusion.id ? { ...e, note } : e)),
                    'Edit exclusion'
                  )
                }
                onDelete={() => {
                  if (exclusion.id === selectedExclusionId) selectExclusion(null)
                  commitExclusions(
                    exclusions.filter((e) => e.id !== exclusion.id),
                    'Remove exclusion'
                  )
                }}
              />
            ))}
          </Box>
          <Box sx={{ px: 1.75, pt: 1, pb: 1.75 }}>
            <Typography variant="mono" sx={{ fontSize: 11.5, color: 'text.disabled' }}>
              {exclusions.length} period{exclusions.length > 1 ? 's' : ''} ·{' '}
              {formatDuration(totalS)} excluded
            </Typography>
          </Box>
        </>
      )}
    </Box>
  )
}

interface ExclusionRowProps {
  exclusion: Exclusion
  selected: boolean
  onSelect: () => void
  onRenote: (note: string | null) => void
  onDelete: () => void
}

function ExclusionRow({
  exclusion,
  selected,
  onSelect,
  onRenote,
  onDelete
}: ExclusionRowProps): React.JSX.Element {
  const [editingNote, setEditingNote] = useState(false)

  const commitNote = (value: string): void => {
    const trimmed = value.trim()
    if (trimmed !== (exclusion.note ?? '')) onRenote(trimmed || null)
    setEditingNote(false)
  }

  return (
    <Box
      onClick={onSelect}
      sx={[
        {
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          borderRadius: '6px',
          px: 0.75,
          py: 0.625,
          cursor: 'pointer'
        },
        selected ? { bgcolor: 'surface.raised' } : {}
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="mono" sx={{ fontSize: 12, flex: 1, minWidth: 0 }}>
          {formatVideoTime(exclusion.start_s)}–{formatVideoTime(exclusion.end_s)}
        </Typography>
        <Typography variant="mono" sx={{ fontSize: 11, color: 'text.secondary' }}>
          {formatDuration(exclusion.end_s - exclusion.start_s)}
        </Typography>
        <IconButton
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          sx={{ color: 'text.disabled', width: 22, height: 22, '&:hover': { color: 'error.main' } }}
        >
          <Symbol name="delete" size={15} />
        </IconButton>
      </Box>
      {editingNote ? (
        <InputBase
          autoFocus
          defaultValue={exclusion.note ?? ''}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => commitNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.currentTarget.value = exclusion.note ?? ''
              e.currentTarget.blur()
            }
          }}
          placeholder="Add a note…"
          sx={{
            fontSize: 11.5,
            border: 1,
            borderColor: 'surface.lineStrong',
            borderRadius: '5px',
            px: 0.75,
            '& input': { p: '2px 0' }
          }}
        />
      ) : (
        <Typography
          onClick={(e) => {
            e.stopPropagation()
            setEditingNote(true)
          }}
          sx={{
            fontSize: 11.5,
            color: exclusion.note ? 'text.secondary' : 'text.disabled',
            fontStyle: exclusion.note ? 'normal' : 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {exclusion.note || 'Add a note…'}
        </Typography>
      )}
    </Box>
  )
}
