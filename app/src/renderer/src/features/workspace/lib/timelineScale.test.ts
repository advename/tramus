import { describe, expect, it } from 'vitest'

import {
  buildTicks,
  percentOfDuration,
  pickTickStep,
  TIMELINE_GUTTER_PX,
  timeAtClientX,
  widthOfDuration
} from './timelineScale'

describe('pickTickStep', () => {
  it('picks a larger step as pixel density drops', () => {
    const dense = pickTickStep(200, 40)
    const sparse = pickTickStep(2, 40)
    expect(sparse).toBeGreaterThan(dense)
  })

  it('always keeps ticks at least minPxBetween apart', () => {
    const step = pickTickStep(15, 40)
    expect(step * 15).toBeGreaterThanOrEqual(40)
  })
})

describe('buildTicks', () => {
  it('covers the full duration and marks some ticks major', () => {
    const ticks = buildTicks(120, 10)
    expect(ticks[0]!.t).toBe(0)
    expect(ticks[ticks.length - 1]!.t).toBeLessThanOrEqual(120)
    expect(ticks.some((tk) => tk.major)).toBe(true)
    expect(ticks.filter((tk) => tk.major)[0]!.label).toMatch(/^\d+:\d{2}$/)
  })

  it('returns nothing for a zero-length video', () => {
    expect(buildTicks(0, 10)).toEqual([])
  })
})

describe('percentOfDuration', () => {
  it('places t=0 at the left gutter and t=durationS at the right gutter', () => {
    expect(percentOfDuration(0, 120)).toBe('calc(14px + (100% - 28px) * 0)')
    expect(percentOfDuration(120, 120)).toBe('calc(14px + (100% - 28px) * 1)')
  })

  it('maps time to a fraction of the space between the gutters', () => {
    expect(percentOfDuration(30, 120)).toBe('calc(14px + (100% - 28px) * 0.25)')
  })

  it('accepts a custom gutter', () => {
    expect(percentOfDuration(30, 120, 0)).toBe('calc(0px + (100% - 0px) * 0.25)')
  })

  it('is safe for a zero duration', () => {
    expect(percentOfDuration(5, 0)).toBe(`${TIMELINE_GUTTER_PX}px`)
  })

  it('clamps out-of-range times', () => {
    expect(percentOfDuration(-10, 120)).toBe('calc(14px + (100% - 28px) * 0)')
    expect(percentOfDuration(999, 120)).toBe('calc(14px + (100% - 28px) * 1)')
  })
})

describe('widthOfDuration', () => {
  it('has no constant gutter offset, unlike percentOfDuration', () => {
    expect(widthOfDuration(30, 120)).toBe('calc((100% - 28px) * 0.25)')
    expect(widthOfDuration(0, 120)).toBe('calc((100% - 28px) * 0)')
  })

  it('is safe for a zero duration', () => {
    expect(widthOfDuration(5, 0)).toBe('0px')
  })
})

describe('timeAtClientX', () => {
  it('maps a pointer position back to time, accounting for the gutter', () => {
    const rect = { left: 100, width: 200 }
    expect(timeAtClientX(200, rect, 60)).toBeCloseTo(30)
    expect(timeAtClientX(-50, rect, 60)).toBe(0)
    expect(timeAtClientX(9999, rect, 60)).toBe(60)
  })

  it('is the inverse of percentOfDuration at the gutter edges', () => {
    const rect = { left: 0, width: 200 }
    // percentOfDuration(0, 60) is `gutterPx` from the left; clicking there should read back ~0.
    expect(timeAtClientX(TIMELINE_GUTTER_PX, rect, 60)).toBeCloseTo(0, 1)
    // percentOfDuration(60, 60) is `gutterPx` from the right.
    expect(timeAtClientX(rect.width - TIMELINE_GUTTER_PX, rect, 60)).toBeCloseTo(60, 1)
  })

  it('is safe when the track is narrower than the gutters', () => {
    expect(timeAtClientX(5, { left: 0, width: 10 }, 60)).toBe(0)
  })
})
