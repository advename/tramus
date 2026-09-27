import { create } from 'zustand'

/**
 * App-wide snackbar queue (design: "Loaded analysis saved on …", "Results updated", errors).
 * Push with `notify(...)` from anywhere — components, hooks, mutation callbacks.
 * Rendered by `<NotificationHost>` in the app shell, one at a time.
 */

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error'

export interface Notification {
  id: number
  severity: NotificationSeverity
  title: string
  message?: string
  /** Material Symbols name; defaults per severity. */
  icon?: string
  action?: { label: string; onClick: () => void }
  /** Auto-hide after this many ms; `null` keeps it until dismissed. Default 6000. */
  autoHideMs?: number | null
}

interface NotificationState {
  queue: Notification[]
  push: (notification: Omit<Notification, 'id'>) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useNotificationStore = create<NotificationState>()((set) => ({
  queue: [],
  push: (notification) => {
    const id = nextId++
    set((s) => ({ queue: [...s.queue, { ...notification, id }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((n) => n.id !== id) }))
}))

export function notify(notification: Omit<Notification, 'id'>): number {
  return useNotificationStore.getState().push(notification)
}

/** Shows an error (e.g. an `ApiError`, whose message is the engine's user-facing `detail`). */
export function notifyError(title: string, error: unknown): number {
  const message = error instanceof Error ? error.message : undefined
  return notify({ severity: 'error', title, message, autoHideMs: null })
}
