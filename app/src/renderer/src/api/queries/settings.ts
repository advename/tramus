import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import { queryKeys } from '../queryKeys'
import type { AppSettings, SystemInfo } from '../types'

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all(),
    queryFn: async (): Promise<AppSettings> => unwrap(await getApiClient().GET('/api/settings'))
  })
}

/** Saves a partial change on top of the current settings (optimistically). */
export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>): Promise<AppSettings> => {
      const current = queryClient.getQueryData<AppSettings>(queryKeys.settings.all())
      const body = { ...current, ...patch } as AppSettings
      return unwrap(await getApiClient().PUT('/api/settings', { body }))
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.all() })
      const previous = queryClient.getQueryData<AppSettings>(queryKeys.settings.all())
      if (previous) queryClient.setQueryData(queryKeys.settings.all(), { ...previous, ...patch })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.settings.all(), context.previous)
    },
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.settings.all(), settings)
  })
}

export function useSystemInfo() {
  return useQuery({
    queryKey: queryKeys.system.info(),
    queryFn: async (): Promise<SystemInfo> => unwrap(await getApiClient().GET('/api/system')),
    staleTime: Infinity
  })
}
