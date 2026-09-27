import { useQuery, useQueryClient } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import { queryKeys } from '../queryKeys'
import type { Library, RecentFolder } from '../types'

/** `GET /library/recent` — folders opened before, most recent first. */
export function useRecentFolders() {
  return useQuery({
    queryKey: queryKeys.library.recent(),
    queryFn: async (): Promise<RecentFolder[]> =>
      unwrap(await getApiClient().GET('/api/library/recent'))
  })
}

/**
 * Opens (or re-opens) the library folder at `path` — `POST /library/open`, cached per path.
 * Re-scans the folder on every mount/refetch, so it also doubles as "refresh this folder".
 */
export function useLibrary(path: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.library.open(path ?? ''),
    queryFn: async (): Promise<Library> => {
      const library = unwrap(await getApiClient().POST('/api/library/open', { body: { path: path! } }))
      // Opening a folder bumps its place in the engine's recent-folders list — keep the Start
      // screen and AppShell's nav (both read `library.recent`) in sync without a manual refetch.
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.recent() })
      return library
    },
    enabled: Boolean(path)
  })
}
