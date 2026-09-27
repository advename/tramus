import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import { alpha } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { useEngineEvents } from '../api/events'
import { useRecentFolders } from '../api/queries'
import { NotificationHost } from '../components/NotificationHost'
import { ShortcutTooltip } from '../components/ShortcutTooltip'
import { Symbol } from '../components/Symbol'
import { useShortcut } from '../lib/shortcuts'

interface NavItem {
  path: string
  icon: string
  label: string
  shortcut: string
}

const RAIL_WIDTH = 52
const ITEM_SIZE = 38

/**
 * The app shell: the 52 px icon-only nav rail (Library/Templates/Batch, Settings pinned to the
 * bottom — `designs/Screens.dc.html`) plus the routed content outlet. Mounted once by
 * `app/routes.tsx` as the layout route, so it also owns the app-wide `useEngineEvents()`
 * subscription and the nav shortcuts (Ctrl/Cmd+1/2/3, Ctrl/Cmd+,).
 */
export function AppShell(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  useEngineEvents()

  // If a folder was opened before (this run or a previous one), Library goes straight back to
  // the most recently opened one instead of the bare, folder-less route.
  const { data: recentFolders } = useRecentFolders()
  const libraryPath = recentFolders?.[0]
    ? `/library?folder=${encodeURIComponent(recentFolders[0].path)}`
    : '/library'

  const navItems: readonly NavItem[] = [
    { path: libraryPath, icon: 'video_library', label: 'Library', shortcut: 'mod+1' },
    { path: '/templates', icon: 'bookmarks', label: 'Templates', shortcut: 'mod+2' },
    { path: '/batch', icon: 'stacks', label: 'Batch', shortcut: 'mod+3' }
  ]

  useShortcut('mod+1', () => void navigate(libraryPath))
  useShortcut('mod+2', () => void navigate('/templates'))
  useShortcut('mod+3', () => void navigate('/batch'))
  useShortcut('mod+,', () => void navigate('/settings'))

  const isActive = (path: string): boolean =>
    location.pathname.startsWith(path.split('?')[0] ?? path)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `${RAIL_WIDTH}px minmax(0, 1fr)`,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden'
      }}
    >
      <Box
        component="nav"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          py: 1.25,
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider'
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '7px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 600,
            fontSize: 14,
            mb: 1.5,
            flexShrink: 0
          }}
        >
          T
        </Box>

        <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
          {navItems.map((item) => (
            <RailButton
              key={item.label}
              icon={item.icon}
              label={item.label}
              shortcut={item.shortcut}
              active={isActive(item.path)}
              onClick={() => void navigate(item.path)}
            />
          ))}
        </List>

        <Box sx={{ flex: 1 }} />

        <List sx={{ p: 0, width: '100%' }}>
          <RailButton
            icon="settings"
            label="Settings"
            shortcut="mod+,"
            active={isActive('/settings')}
            onClick={() => void navigate('/settings')}
          />
        </List>
      </Box>

      <Box
        component="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        <Outlet />
      </Box>
      <NotificationHost />
    </Box>
  )
}

interface RailButtonProps {
  icon: string
  label: string
  shortcut: string
  active: boolean
  onClick: () => void
}

function RailButton({
  icon,
  label,
  shortcut,
  active,
  onClick
}: RailButtonProps): React.JSX.Element {
  return (
    <ShortcutTooltip title={label} shortcut={shortcut} placement="right">
      <ListItemButton
        onClick={onClick}
        selected={active}
        disableGutters
        sx={[
          {
            width: ITEM_SIZE,
            height: ITEM_SIZE,
            minHeight: ITEM_SIZE,
            mx: 'auto',
            borderRadius: '8px',
            justifyContent: 'center',
            color: 'text.secondary',
            '&.Mui-selected': { color: 'text.primary' },
            '&.Mui-selected:hover': { color: 'text.primary' }
          },
          (theme) =>
            active
              ? {
                  bgcolor: alpha(theme.palette.primary.main, 0.13),
                  '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.13) },
                  '&.Mui-selected:hover': { bgcolor: alpha(theme.palette.primary.main, 0.18) }
                }
              : {}
        ]}
      >
        <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: 'inherit' }}>
          <Symbol name={icon} />
        </ListItemIcon>
      </ListItemButton>
    </ShortcutTooltip>
  )
}
