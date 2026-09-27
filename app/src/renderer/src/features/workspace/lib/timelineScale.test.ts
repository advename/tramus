import { describe, expect, it } from 'vitest'

import { buildTicks, percentOfDuration, pickTickStep, timeAtClientX } from './timelineScale'

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
  it('maps time to a percentage string', () => {
    expect(percentOfDuration(30, 120)).toBe('25%')
  })

  it('is safe for a zero duration', () => {
    expect(percentOfDuration(5, 0)).toBe('0%')
  })
})

describe('timeAtClientX', () => {
  it('maps a pointer position back to time, clamped to the duration', () => {
    const rect = { left: 100, width: 200 }
    expect(timeAtClientX(200, rect, 60)).toBeCloseTo(30)
    expect(timeAtClientX(-50, rect, 60)).toBe(0)
    expect(timeAtClientX(9999, rect, 60)).toBe(60)
  })
})
