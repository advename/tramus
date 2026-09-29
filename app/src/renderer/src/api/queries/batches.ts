import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import { queryKeys } from '../queryKeys'
import type {
  Batch,
  BatchCheckItem,
  BatchItemRequest,
  BatchListResponse,
  BatchView
} from '../types'

/** `POST /batches/check` — one `BatchCheckItem` per video, for the Batch "Check" step. */
export function useCheckBatch() {
  return useMutation({
    mutationFn: async (body: {
      template_id: string
      video_ids: string[]
    }): Promise<BatchCheckItem[]> =>
      unwrap(await getApiClient().POST('/api/batches/check', { body }))
  })
}

/** `POST /batches` — starts tracking every item as a job and returns the batch + its jobs. Also
 * persists a `BatchRecord`, so the batch survives an app restart. */
export function useCreateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { template_id: string; items: BatchItemRequest[] }): Promise<Batch> =>
      unwrap(await getApiClient().POST('/api/batches', { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.batches.all() })
    }
  })
}

/** `GET /batches` — every saved batch (newest first) with live per-item status, plus any batch
 * files that failed to parse (`broken`) so the UI can offer to reset them. */
export function useBatches() {
  return useQuery({
    queryKey: queryKeys.batches.all(),
    queryFn: async (): Promise<BatchListResponse> =>
      unwrap(await getApiClient().GET('/api/batches'))
  })
}

/** `GET /batches/{id}` — one saved batch with live per-item status. */
export function useBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.batches.detail(batchId ?? ''),
    queryFn: async (): Promise<BatchView> =>
      unwrap(
        await getApiClient().GET('/api/batches/{batch_id}', {
          params: { path: { batch_id: batchId! } }
        })
      ),
    enabled: Boolean(batchId)
  })
}

/** `DELETE /batches/{id}` — reset: removes the saved batch record only (sidecars are kept). */
export function useDeleteBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (batchId: string): Promise<void> => {
      const { error, response } = await getApiClient().DELETE('/api/batches/{batch_id}', {
        params: { path: { batch_id: batchId } }
      })
      if (error !== undefined || !response.ok) {
        unwrap({ error: error ?? { detail: 'Could not reset this batch.' }, response })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.batches.all() })
  })
}
