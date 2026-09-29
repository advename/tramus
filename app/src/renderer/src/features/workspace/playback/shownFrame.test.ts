import { describe, expect, it } from 'vitest'

import { selectShownFrame } from './shownFrame'

describe('selectShownFrame', () => {
  it('while playing, shows the predictive pipeline frame when it has one', () => {
    expect(selectShownFrame(true, 120, 100, 130)).toBe(120)
  })

  it('while playing, falls back to the exact-frame pipeline before the predictive one has caught up', () => {
    // Just after playback starts: nothing predicted/cached yet, but the exact path is mid-fetch
    // and still showing the frame from before playback began.
    expect(selectShownFrame(true, null, 42, 130)).toBe(42)
  })

  it('while playing, falls back to the clock frame when nothing has loaded at all', () => {
    expect(selectShownFrame(true, null, null, 130)).toBe(130)
  })

  it('while paused, shows the exact-frame pipeline frame once it matches the clock', () => {
    expect(selectShownFrame(false, null, 50, 50)).toBe(50)
  })

  it('while paused, keeps showing the stale exact-frame pipeline frame until the new one arrives', () => {
    // A seek/scrub just moved `currentFrame` to 60, but the exact fetch for it hasn't resolved —
    // the pipeline (and its bitmap) is still on 50.
    expect(selectShownFrame(false, null, 50, 60)).toBe(50)
  })

  it('while paused, ignores a stray predictive-pipeline frame', () => {
    expect(selectShownFrame(false, 999, 50, 60)).toBe(50)
  })

  it('while paused, falls back to the clock frame when nothing has loaded at all', () => {
    expect(selectShownFrame(false, null, null, 0)).toBe(0)
  })
})
