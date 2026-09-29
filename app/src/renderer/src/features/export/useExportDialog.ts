import { useState } from 'react'

import type { ExportFormat } from '../../api/types'

export interface ExportDialogRequest {
  videoIds: string[]
  getDefaultPath: (format: ExportFormat) => string
}

/**
 * Open/close + "what to export" state for `<ExportDialog>`, shared by every entry point (Results,
 * the Library selection bar, Batch's "Export all"). Call `open(request)` from a button's
 * `onClick`, spread the result into `<ExportDialog>`.
 */
export function useExportDialog() {
  const [request, setRequest] = useState<ExportDialogRequest | null>(null)

  return {
    isOpen: request !== null,
    videoIds: request?.videoIds ?? [],
    getDefaultPath: request?.getDefaultPath ?? (() => ''),
    open: (next: ExportDialogRequest) => setRequest(next),
    close: () => setRequest(null)
  }
}
