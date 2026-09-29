import { create } from 'zustand'

/**
 * Batches themselves are persisted by the engine (`GET/POST/DELETE /api/batches`) and survive an
 * app restart — this store only holds the small bit of UI state that doesn't belong there: which
 * batch the screen is currently showing, and whether the user is deliberately building a new one.
 *
 * `selectedBatchId: null` means "no explicit choice yet" — the screen falls back to the most
 * recently saved batch. Selecting one (just created, or explicitly reset) sets it; starting a new
 * batch clears it again and sets `startingNew`, which overrides the "most recent" fallback so the
 * Choose/Check flow shows even though an older batch still exists.
 */
interface BatchStoreState {
  selectedBatchId: string | null
  startingNew: boolean
  /** Shows this batch's Run/Finish view (e.g. right after `POST /batches` succeeds). */
  selectBatch: (batchId: string) => void
  /** Switches to Choose for a new batch, regardless of what's already saved. */
  startNewBatch: () => void
}

export const useBatchStore = create<BatchStoreState>()((set) => ({
  selectedBatchId: null,
  startingNew: false,
  selectBatch: (batchId) => set({ selectedBatchId: batchId, startingNew: false }),
  startNewBatch: () => set({ selectedBatchId: null, startingNew: true })
}))
