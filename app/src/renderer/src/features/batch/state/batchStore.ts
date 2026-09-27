import { create } from 'zustand'

/**
 * The batch currently running/just finished, kept outside the screen's component tree so
 * navigating away from `/batch` and back still shows it ("Tracking continues if you leave this
 * page." — `designs/Screens.dc.html`). Cleared explicitly when the user starts a new batch.
 */
interface BatchStoreState {
  activeBatchId: string | null
  templateId: string | null
  setActiveBatch: (args: { batchId: string; templateId: string } | null) => void
}

export const useBatchStore = create<BatchStoreState>()((set) => ({
  activeBatchId: null,
  templateId: null,
  setActiveBatch: (args) =>
    set({ activeBatchId: args?.batchId ?? null, templateId: args?.templateId ?? null })
}))
