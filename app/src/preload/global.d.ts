import type { TramusApi } from '@shared/ipc'

export {}

declare global {
  interface Window {
    /** Bridged by src/preload/index.ts via contextBridge. See @shared/ipc for the full contract. */
    readonly tramus: TramusApi
  }
}
