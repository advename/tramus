import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

/**
 * Unit tests for pure `lib/` helpers (geometry, coordinate transforms, trail windowing, …).
 * Renderer components talk to the Electron main process and the engine over HTTP, so they aren't
 * covered here — this is for logic worth testing in isolation.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.ts']
  }
})
