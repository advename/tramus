import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'

import { EngineProvider } from '../api/EngineProvider'
import { queryClient } from '../api/queryClient'
import { ThemeProvider } from '../theme/ThemeProvider'
import { router } from './routes'

interface AppProvidersProps {
  children?: ReactNode
}

/**
 * The provider stack, outermost first: `EngineProvider` (blocks until the local engine + API
 * client are ready) → `QueryClientProvider` (server state) → `ThemeProvider` (reads the theme
 * preference through the now-ready API client) → `RouterProvider` (the hash router — it owns
 * rendering the rest of the tree, so `children` is normally unused; it's accepted for tests/
 * Storybook-style wrapping).
 */
export function AppProviders({ children }: AppProvidersProps): React.JSX.Element {
  return (
    <EngineProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </EngineProvider>
  )
}
