import { createHashRouter } from 'react-router'

import { BatchScreen } from '../features/batch'
import { LibraryScreen } from '../features/library'
import { SettingsScreen } from '../features/settings'
import { StartScreen } from '../features/start'
import { TemplatesScreen } from '../features/templates'
import { WorkspaceScreen } from '../features/workspace'
import { AppShell } from './AppShell'

/**
 * The route table. A hash router (`#/library`, not `/library`) because the packaged app loads
 * `index.html` from `file://` — a browser/history router can't resolve real paths there.
 *
 * To add a screen: build it under `features/<name>/`, export it from `features/<name>/index
 * .tsx`, and add a route here pointing at it. `AppShell` is the single layout route (nav rail +
 * outlet), so every screen just needs to be `<AppShell>`'s child, not reimplement chrome.
 */
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <StartScreen /> },
      { path: '/library', element: <LibraryScreen /> },
      { path: '/templates', element: <TemplatesScreen /> },
      { path: '/batch', element: <BatchScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/videos/:videoId/:step', element: <WorkspaceScreen /> }
    ]
  }
])
