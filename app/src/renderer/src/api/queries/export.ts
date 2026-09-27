import { useMutation } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import type { ExportFormat } from '../types'

export interface ExportVideosArgs {
  videoIds: string[]
  format: ExportFormat
  path: string
}

/** `POST /export` — writes one workbook/CSV pair for the given videos and returns the file paths. */
export function useExportVideos() {
  return useMutation({
    mutationFn: async (args: ExportVideosArgs): Promise<{ files: string[] }> =>
      unwrap(
        await getApiClient().POST('/api/export', {
          body: { video_ids: args.videoIds, format: args.format, path: args.path }
        })
      )
  })
}
