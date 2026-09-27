import { useMemo, type JSX, type ReactNode } from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useQuery } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { createAppTheme, type ThemeMode } from './createAppTheme'

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Resolves the active theme mode from the engine's `AppSettings.theme` ("dark" | "light" |
 * "system") and applies the matching MUI theme + `CssBaseline`. Falls back to dark while the
 * settings query is loading or if it fails — the app should never render unthemed.
 *
 * Must render inside `<EngineProvider>` (for the API client) and `<QueryClientProvider>`.
 */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.all(),
    queryFn: async () => unwrap(await getApiClient().GET('/api/settings')),
    staleTime: Infinity,
    retry: false
  })

  const mode: ThemeMode = useMemo(() => {
    const preference = settingsQuery.data?.theme ?? 'dark'
    if (preference === 'system') return prefersDark ? 'dark' : 'light'
    return preference
  }, [settingsQuery.data?.theme, prefersDark])

  const theme = useMemo(() => createAppTheme(mode), [mode])

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  )
}
