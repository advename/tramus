import { useState } from 'react'
import Box from '@mui/material/Box'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'

import { Kbd } from '../../components/Kbd'
import { Symbol } from '../../components/Symbol'
import {
  describeContexts,
  formatShortcutKeys,
  matchesQuery,
  SHORTCUT_LIST,
  shortcutsByGroup
} from '../../lib/shortcutRegistry'
import { formatShortcut } from '../../lib/shortcuts'
import { SettingsGroup } from './SettingsParts'

/**
 * Settings → Keyboard shortcuts: every shortcut in `lib/shortcutRegistry.ts`, by group, with the
 * keys for this platform and where each one works. The search box filters by label, key or step.
 */
export function KeyboardShortcutsSection(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const groups = shortcutsByGroup(SHORTCUT_LIST.filter((shortcut) => matchesQuery(shortcut, query)))

  return (
    <SettingsGroup title="Keyboard shortcuts">
      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
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
            color: 'text.disabled'
          }}
        >
          <Symbol name="search" size={17} />
          <InputBase
            placeholder="Search shortcuts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            inputProps={{ 'aria-label': 'Search shortcuts' }}
            sx={{ fontSize: 12.5, flex: 1, color: 'text.primary' }}
          />
        </Box>
      </Box>

      {groups.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', p: 2 }}>
          No shortcut matches “{query.trim()}”.
        </Typography>
      ) : (
        groups.map(({ group, shortcuts }) => (
          <Box
            key={group}
            sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
          >
            <Typography
              variant="overline"
              color="text.disabled"
              sx={{ display: 'block', px: 2, pt: 1.25 }}
            >
              {group}
            </Typography>
            {shortcuts.map((shortcut) => (
              <Box
                key={shortcut.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 0.75 }}
              >
                <Typography sx={{ flex: 1, minWidth: 0 }}>{shortcut.label}</Typography>
                <Typography variant="caption" color="text.disabled" noWrap>
                  {describeContexts(shortcut.active)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, minWidth: 96, justifyContent: 'flex-end' }}>
                  <Kbd aria-label={formatShortcutKeys(shortcut)}>
                    {formatShortcut(shortcut.combo)}
                  </Kbd>
                  {shortcut.alias ? <Kbd>{formatShortcut(shortcut.alias)}</Kbd> : null}
                </Box>
              </Box>
            ))}
          </Box>
        ))
      )}
    </SettingsGroup>
  )
}
