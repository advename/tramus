import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import { queryKeys } from '../queryKeys'
import type { Batch, BatchCheckItem, BatchItemRequest } from '../types'

/** `POST /batches/check` — one `BatchCheckItem` per video, for the Batch "Check" step. */
export function useCheckBatch() {
  return useMutation({
    mutationFn: async (body: { template_id: string; video_ids: string[] }): Promise<BatchCheckItem[]> =>
      unwrap(await getApiClient().POST('/api/batches/check', { body }))
  })
}

/** `POST /batches` — starts tracking every item as a job and returns the batch + its jobs. */
export function useCreateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { template_id: string; items: BatchItemRequest[] }): Promise<Batch> =>
      unwrap(await getApiClient().POST('/api/batches', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() })
  })
}
