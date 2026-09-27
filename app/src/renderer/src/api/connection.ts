import type { EngineConnection } from '@shared/ipc'

/**
 * The engine connection, set once by `<EngineProvider>` after `window.tramus.engine
 * .getConnection()` resolves. Read by `api/client.ts` (the HTTP client) and `api/urls.ts`
 * (image/media URLs), which both need the base URL + token but can't take them as React props
 * since they're plain functions, not components.
 */
let connection: EngineConnection | null = null

export function setEngineConnection(next: EngineConnection): void {
  connection = next
}

/** Throws if called before `<EngineProvider>` has resolved — every consumer renders under it. */
export function getEngineConnection(): EngineConnection {
  if (!connection) {
    throw new Error('Engine connection not established yet — render inside <EngineProvider>.')
  }
  return connection
}
