import { describe, expect, it } from 'vitest'

import { initPlaybackClock, stepPlaybackClock } from './playbackStep'

/** 25 fps-ish frame times: frame i at i * 0.04s. Duration is `length * 0.04`. */
function frameTimes(length: number, interval = 0.04): Float64Array {
  return Float64Array.from({ length }, (_, i) => i * interval)
}

describe('stepPlaybackClock', () => {
  it('accumulates sub-frame progress across ticks at 1x, unlike recomputing from the frame time', () => {
    // A 16ms tick is smaller than the 40ms frame interval, so a single tick never crosses a frame
    // boundary — this is exactly the bug: recomputing `nextTime` from `timeOfFrame(currentFrame)`
    // every tick discards that 16ms each time, so playback never advances. A continuous clock
    // must accumulate it instead.
    const times = frameTimes(10)
    let state = initPlaybackClock(times, 0)
    let frame = 0
    for (let i = 0; i < 3; i++) {
      const result = stepPlaybackClock(state, frame, 0.016, 1, times)
      state = result.state
      frame = result.frame
    }
    // 3 * 16ms = 48ms > one 40ms frame interval.
    expect(frame).toBe(1)
  })

  it('does not advance the frame before a full frame interval has accumulated', () => {
    const times = frameTimes(10)
    const state = initPlaybackClock(times, 0)
    const result = stepPlaybackClock(state, 0, 0.016, 1, times)
    expect(result.frame).toBe(0)
    expect(result.state.time).toBeCloseTo(0.016)
  })

  it('scales the advance by speed', () => {
    const times = frameTimes(10)
    const state = initPlaybackClock(times, 0)
    const result = stepPlaybackClock(state, 0, 0.016, 4, times)
    expect(result.state.time).toBeCloseTo(0.064)
    expect(result.frame).toBe(1)
  })

  it('re-syncs to the current frame when it changed externally (seek/scrub/step)', () => {
    const times = frameTimes(100)
    const state = { time: 0.2, frame: 5 } // clock thinks we're at frame 5...
    // ...but something else (a scrub) moved playback to frame 50 since the last tick.
    const result = stepPlaybackClock(state, 50, 0.016, 1, times)
    expect(result.state.time).toBeCloseTo(times[50]! + 0.016)
    expect(result.frame).toBe(50)
  })

  it('keeps accumulating on its own frame without resyncing', () => {
    const times = frameTimes(10)
    const state = { time: 0.05, frame: 1 }
    const result = stepPlaybackClock(state, 1, 0.016, 1, times)
    expect(result.state.time).toBeCloseTo(0.066)
  })

  it('reports finished once time reaches the end of the video', () => {
    const times = frameTimes(5) // duration = 5 * 0.04 = 0.2
    const state = { time: 0.19, frame: 4 }
    const result = stepPlaybackClock(state, 4, 0.02, 1, times)
    expect(result.finished).toBe(true)
    expect(result.frame).toBe(4)
    expect(result.state.frame).toBe(4)
  })
})

describe('initPlaybackClock', () => {
  it('syncs to the given frame time', () => {
    const times = frameTimes(10)
    expect(initPlaybackClock(times, 3)).toEqual({ time: times[3], frame: 3 })
  })
})
