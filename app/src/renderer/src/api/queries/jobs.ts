import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import { queryKeys } from '../queryKeys'
import type { Job, JobState } from '../types'

export const TERMINAL_JOB_STATES: ReadonlySet<JobState> = new Set([
  'succeeded',
  'failed',
  'cancelled'
])

/** All jobs the engine knows about. Kept live by `useEngineEvents` (no polling). */
export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs.all(),
    queryFn: async (): Promise<Job[]> => unwrap(await getApiClient().GET('/api/jobs'))
  })
}

export function useJob(jobId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId ?? ''),
    queryFn: async (): Promise<Job> =>
      unwrap(
        await getApiClient().GET('/api/jobs/{job_id}', { params: { path: { job_id: jobId! } } })
      ),
    enabled: Boolean(jobId)
  })
}

export function useCancelJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (jobId: string): Promise<Job> =>
      unwrap(
        await getApiClient().POST('/api/jobs/{job_id}/cancel', {
          params: { path: { job_id: jobId } }
        })
      ),
    onSuccess: (job) => queryClient.setQueryData(queryKeys.jobs.detail(job.id), job)
  })
}
