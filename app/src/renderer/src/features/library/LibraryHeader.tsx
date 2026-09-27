import { type RefObject, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputBase from '@mui/material/InputBase'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

import type { VideoStatus } from '../../api/types'
import { Kbd } from '../../components/Kbd'
import { ShortcutTooltip } from '../../components/ShortcutTooltip'
import { Symbol } from '../../components/Symbol'
import { STATUS_LABEL } from './statusLabel'
import type { LibraryViewMode } from './lib'

export type StatusFilter = VideoStatus | 'all'

export interface LibraryHeaderProps {
  folderName: string
  folderPath: string
  search: string
  onSearchChange: (value: string) => void
  searchInputRef: RefObject<HTMLInputElement | null>
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  viewMode: LibraryViewMode
  onViewModeChange: (mode: LibraryViewMode) => void
  onOpenFolder: () => void
}

const STATUS_OPTIONS: readonly StatusFilter[] = [
  'all',
  'new',
  'set_up',
  'tracked',
  'reviewed',
  'exported'
]

/** The Library screen's top bar: folder identity, search, status filter, table/grid toggle. */
export function LibraryHeader({
  folderName,
  folderPath,
  search,
  onSearchChange,
  searchInputRef,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  onOpenFolder
}: LibraryHeaderProps): React.JSX.Element {
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<HTMLElement | null>(null)

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        px: 2,
        height: 60,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flex: 'none',
        minWidth: 0
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }} noWrap>
          {folderName}
        </Typography>
        <Typography variant="mono" color="text.disabled" sx={{ fontSize: 11.5 }} noWrap>
          {folderPath}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          height: 30,
          px: 1.25,
          border: 1,
          borderColor: 'surface.lineStrong',
          borderRadius: '7px',
          bgcolor: 'background.default',
          width: 220,
          minWidth: 120,
          flex: '0 1 220px',
          color: 'text.disabled'
        }}
      >
        <Symbol name="search" size={17} />
        <InputBase
          inputRef={searchInputRef}
          placeholder="Search videos"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          sx={{ fontSize: 12.5, flex: 1, color: 'text.primary' }}
        />
        <Kbd>Ctrl+F</Kbd>
      </Box>

      <Button
        variant="outlined"
        onClick={(event) => setStatusMenuAnchor(event.currentTarget)}
        endIcon={<Symbol name="expand_more" size={17} sx={{ color: 'text.disabled' }} />}
        sx={{
          height: 30,
          px: 1.25,
          fontSize: 12.5,
          fontWeight: 400,
          color: 'text.primary',
          borderColor: 'surface.lineStrong',
          whiteSpace: 'nowrap'
        }}
      >
        Status: {statusFilter === 'all' ? 'All' : STATUS_LABEL[statusFilter]}
      </Button>
      <Menu
        anchorEl={statusMenuAnchor}
        open={statusMenuAnchor !== null}
        onClose={() => setStatusMenuAnchor(null)}
      >
        {STATUS_OPTIONS.map((option) => (
          <MenuItem
            key={option}
            selected={option === statusFilter}
            onClick={() => {
              onStatusFilterChange(option)
              setStatusMenuAnchor(null)
            }}
          >
            {option === 'all' ? 'All' : STATUS_LABEL[option]}
          </MenuItem>
        ))}
      </Menu>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={viewMode}
        onChange={(_event, next: LibraryViewMode | null) => {
          if (next !== null) onViewModeChange(next)
        }}
        sx={{ p: '3px', border: 1, borderColor: 'divider', borderRadius: '8px' }}
      >
        <ShortcutTooltip title="Table" shortcut="mod+shift+1">
          <ToggleButton
            value="table"
            sx={{ width: 30, height: 24, border: 'none', borderRadius: '5px !important', p: 0 }}
          >
            <Symbol name="table_rows" size={17} />
          </ToggleButton>
        </ShortcutTooltip>
        <ShortcutTooltip title="Grid" shortcut="mod+shift+2">
          <ToggleButton
            value="grid"
            sx={{ width: 30, height: 24, border: 'none', borderRadius: '5px !important', p: 0 }}
          >
            <Symbol name="grid_view" size={17} />
          </ToggleButton>
        </ShortcutTooltip>
      </ToggleButtonGroup>

      <ShortcutTooltip title="Open folder" shortcut="mod+o">
        <Button
          variant="outlined"
          onClick={onOpenFolder}
          startIcon={<Symbol name="folder_open" size={17} />}
          sx={{
            height: 30,
            px: 1.5,
            fontSize: 12.5,
            fontWeight: 500,
            color: 'text.primary',
            borderColor: 'surface.lineStrong',
            whiteSpace: 'nowrap'
          }}
        >
          Open folder…
        </Button>
      </ShortcutTooltip>
    </Box>
  )
}
