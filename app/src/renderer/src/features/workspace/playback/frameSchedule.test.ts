import { describe, expect, it } from 'vitest'

import {
  computeStride,
  lookaheadCount,
  nextGridFrame,
  pickDisplayFrame,
  predictFrames
} from './frameSchedule'

describe('computeStride', () => {
  it('requests every frame at 1x when source fps is already below the fetch target', () => {
    // Sample1.mp4-like: ~25 fps source, 60 fps fetch budget.
    expect(computeStride(25, 1, 60)).toBe(1)
  })

  it('skips frames at high speed to stay within the fetch budget', () => {
    // 25 fps * 4x = 100 source frames/s to cover; at a 60 fps fetch budget that needs stride 2.
    expect(computeStride(25, 4, 60)).toBe(2)
  })

  it('rounds up so the request rate never exceeds the target', () => {
    // 25 * 8 = 200 source frames/s / 60 => stride 4 (>=3.33), giving 50 requests/s, not 60+.
    expect(computeStride(25, 8, 60)).toBe(4)
  })

  it('falls back to 1 for invalid inputs', () => {
    expect(computeStride(0, 4, 60)).toBe(1)
    expect(computeStride(25, 0, 60)).toBe(1)
    expect(computeStride(25, 4, 0)).toBe(1)
  })
})

describe('predictFrames', () => {
  it('steps by stride starting at `from`', () => {
    expect(predictFrames(10, 4, 3, 1000)).toEqual([10, 14, 18])
  })

  it('stops at frameCount', () => {
    expect(predictFrames(995, 4, 5, 1000)).toEqual([995, 999])
  })

  it('returns nothing once `from` is past the end', () => {
    expect(predictFrames(1000, 4, 3, 1000)).toEqual([])
  })
})

describe('pickDisplayFrame', () => {
  it('picks the newest cached frame at or before the current frame', () => {
    expect(pickDisplayFrame([10, 14, 18, 22], 16, null)).toBe(14)
  })

  it('never picks a frame ahead of the clock', () => {
    expect(pickDisplayFrame([10, 20, 30], 15, null)).toBe(10)
  })

  it('picks the exact match when cached', () => {
    expect(pickDisplayFrame([10, 20, 30], 20, null)).toBe(20)
  })

  it('keeps showing the previous frame when nothing at or before the clock is cached yet', () => {
    // e.g. right after a seek forward — the pipeline hasn't caught up, and the only cached
    // frames are stale ones from before the seek.
    expect(pickDisplayFrame([5, 8], 50, 8)).toBe(8)
  })

  it('falls back to the earliest cached frame when nothing has ever been shown', () => {
    expect(pickDisplayFrame([40, 45], 10, null)).toBe(40)
  })

  it('returns null when nothing is cached', () => {
    expect(pickDisplayFrame([], 10, null)).toBeNull()
  })
})

describe('nextGridFrame', () => {
  it('returns the next multiple of the stride after the current frame', () => {
    expect(nextGridFrame(0, 2)).toBe(2)
    expect(nextGridFrame(101, 2)).toBe(102)
    expect(nextGridFrame(102, 2)).toBe(104)
    expect(nextGridFrame(7, 1)).toBe(8)
  })

  it('keeps the predicted set stable while the clock moves within a stride', () => {
    expect(predictFrames(nextGridFrame(100, 4), 4, 3, 1000)).toEqual(
      predictFrames(nextGridFrame(103, 4), 4, 3, 1000)
    )
  })
})

describe('lookaheadCount', () => {
  it('covers the requested seconds of playback', () => {
    // 0.6 s at 25 fps × 4 = 60 source frames; stride 2 → 30 grid frames.
    expect(lookaheadCount(0.6, 25, 4, 2, 8)).toBe(30)
  })

  it('never goes below the minimum', () => {
    expect(lookaheadCount(0.6, 25, 0.25, 1, 8)).toBe(8)
  })
})
