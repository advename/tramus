import { describe, expect, it } from 'vitest'

import { clampTimelineHeight, MIN_TIMELINE_HEIGHT } from './timelineLayout'

describe('clampTimelineHeight', () => {
  it('never goes below the minimum', () => {
    expect(clampTimelineHeight(10, 800)).toBe(MIN_TIMELINE_HEIGHT)
  })

  it('never exceeds 60% of the viewport height', () => {
    expect(clampTimelineHeight(10000, 800)).toBe(480)
  })

  it('passes through a value already in range', () => {
    expect(clampTimelineHeight(300, 800)).toBe(300)
  })

  it('falls back to the minimum when the viewport is too small for 60% to reach it', () => {
    expect(clampTimelineHeight(300, 100)).toBe(MIN_TIMELINE_HEIGHT)
  })
})
