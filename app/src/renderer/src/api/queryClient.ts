import { QueryClient } from '@tanstack/react-query'

/**
 * Shared TanStack Query client. The engine is a local, single-user process, so queries default
 * to a short stale time (avoid refetch storms while flipping between steps) and a single retry
 * (fail fast — there's no flaky network to a local process, so a repeated failure means the
 * request is actually wrong).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
})
