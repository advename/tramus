import { describe, expect, it } from 'vitest'

import type { Exclusion } from '../../../api/types'
import {
  exclusionAtTime,
  exclusionsTotalS,
  mergeExclusionEdge,
  mergeExclusions,
  moveExclusionEdge
} from './exclusions'

function makeExclusion(overrides: Partial<Exclusion>): Exclusion {
  return { id: 'x1', start_s: 10, end_s: 20, note: null, ...overrides }
}

describe('mergeExclusions', () => {
  it('keeps a disjoint addition as a separate entry', () => {
    const existing = [makeExclusion({ id: 'a', start_s: 0, end_s: 5 })]
    const addition = makeExclusion({ id: 'b', start_s: 10, end_s: 15 })
    const result = mergeExclusions(existing, addition)
    expect(result).toEqual([
      { id: 'a', start_s: 0, end_s: 5, note: null },
      { id: 'b', start_s: 10, end_s: 15, note: null }
    ])
  })

  it('merges an overlapping addition into one entry, keeping the earliest-starting id', () => {
    const existing = [makeExclusion({ id: 'a', start_s: 0, end_s: 10 })]
    const addition = makeExclusion({ id: 'b', start_s: 5, end_s: 15 })
    const result = mergeExclusions(existing, addition)
    expect(result).toEqual([{ id: 'a', start_s: 0, end_s: 15, note: null }])
  })

  it('merges an adjacent (touching) addition instead of stacking a duplicate', () => {
    const existing = [makeExclusion({ id: 'a', start_s: 0, end_s: 10 })]
    const addition = makeExclusion({ id: 'b', start_s: 10, end_s: 15 })
    const result = mergeExclusions(existing, addition)
    expect(result).toEqual([{ id: 'a', start_s: 0, end_s: 15, note: null }])
  })

  it('bridges two separate existing exclusions into one when the addition spans both', () => {
    const existing = [
      makeExclusion({ id: 'a', start_s: 0, end_s: 5 }),
      makeExclusion({ id: 'c', start_s: 20, end_s: 25 })
    ]
    const addition = makeExclusion({ id: 'b', start_s: 4, end_s: 21 })
    const result = mergeExclusions(existing, addition)
    expect(result).toEqual([{ id: 'a', start_s: 0, end_s: 25, note: null }])
  })

  it('combines notes of merged entries, deduplicated, dropping empty ones', () => {
    const existing = [makeExclusion({ id: 'a', start_s: 0, end_s: 10, note: 'Cage open' })]
    const addition = makeExclusion({ id: 'b', start_s: 5, end_s: 15, note: 'Cage open' })
    expect(mergeExclusions(existing, addition)[0]!.note).toBe('Cage open')

    const addition2 = makeExclusion({ id: 'b', start_s: 5, end_s: 15, note: 'Lights flicker' })
    expect(mergeExclusions(existing, addition2)[0]!.note).toBe('Cage open; Lights flicker')
  })

  it('keeps the list sorted by start_s', () => {
    const existing = [makeExclusion({ id: 'a', start_s: 50, end_s: 60 })]
    const addition = makeExclusion({ id: 'b', start_s: 0, end_s: 5 })
    const result = mergeExclusions(existing, addition)
    expect(result.map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('moveExclusionEdge', () => {
  it('moves the start without merging, even if it now overlaps a neighbour', () => {
    const exclusions = [
      makeExclusion({ id: 'a', start_s: 0, end_s: 5 }),
      makeExclusion({ id: 'b', start_s: 10, end_s: 20 })
    ]
    const result = moveExclusionEdge(exclusions, 'b', 'start', 2)
    expect(result).toHaveLength(2)
    expect(result.find((e) => e.id === 'b')).toEqual({ id: 'b', start_s: 2, end_s: 20, note: null })
  })

  it('clamps the start so it never reaches or passes the end', () => {
    const exclusions = [makeExclusion({ id: 'a', start_s: 10, end_s: 20 })]
    const result = moveExclusionEdge(exclusions, 'a', 'start', 25)
    expect(result[0]!.start_s).toBeLessThan(result[0]!.end_s)
  })

  it('clamps the end so it never reaches or passes the start', () => {
    const exclusions = [makeExclusion({ id: 'a', start_s: 10, end_s: 20 })]
    const result = moveExclusionEdge(exclusions, 'a', 'end', 5)
    expect(result[0]!.start_s).toBeLessThan(result[0]!.end_s)
  })

  it('is a no-op for an unknown id', () => {
    const exclusions = [makeExclusion({ id: 'a' })]
    expect(moveExclusionEdge(exclusions, 'missing', 'start', 1)).toBe(exclusions)
  })
})

describe('mergeExclusionEdge', () => {
  it('merges into the right neighbour when the end is dragged past it, keeping the dragged id', () => {
    const exclusions = [
      makeExclusion({ id: 'a', start_s: 0, end_s: 10 }),
      makeExclusion({ id: 'b', start_s: 20, end_s: 30 })
    ]
    const { exclusions: result, id } = mergeExclusionEdge(exclusions, 'a', 'end', 25)
    expect(result).toEqual([{ id: 'a', start_s: 0, end_s: 30, note: null }])
    expect(id).toBe('a')
  })

  it('merges into the left neighbour when the start is dragged past it, handing off the id', () => {
    const exclusions = [
      makeExclusion({ id: 'a', start_s: 0, end_s: 10 }),
      makeExclusion({ id: 'b', start_s: 20, end_s: 30 })
    ]
    // Dragging b's start back past a's end: the merged entry now starts at 0, where `a` used to
    // start, so `a`'s id wins — the caller must reselect using the returned id, not `b`.
    const { exclusions: result, id } = mergeExclusionEdge(exclusions, 'b', 'start', 5)
    expect(result).toEqual([{ id: 'a', start_s: 0, end_s: 30, note: null }])
    expect(id).toBe('a')
  })

  it('leaves a disjoint move as its own entry, keeping its id', () => {
    const exclusions = [
      makeExclusion({ id: 'a', start_s: 0, end_s: 10 }),
      makeExclusion({ id: 'b', start_s: 20, end_s: 30 })
    ]
    const { exclusions: result, id } = mergeExclusionEdge(exclusions, 'b', 'start', 15)
    expect(result).toEqual([
      { id: 'a', start_s: 0, end_s: 10, note: null },
      { id: 'b', start_s: 15, end_s: 30, note: null }
    ])
    expect(id).toBe('b')
  })
})

describe('exclusionsTotalS', () => {
  it('sums every exclusion length', () => {
    const exclusions = [
      makeExclusion({ id: 'a', start_s: 0, end_s: 5 }),
      makeExclusion({ id: 'b', start_s: 10, end_s: 12.5 })
    ]
    expect(exclusionsTotalS(exclusions)).toBeCloseTo(7.5)
  })

  it('is zero for an empty list', () => {
    expect(exclusionsTotalS([])).toBe(0)
  })
})

describe('exclusionAtTime', () => {
  const exclusions = [
    makeExclusion({ id: 'a', start_s: 0, end_s: 5 }),
    makeExclusion({ id: 'b', start_s: 10, end_s: 20 })
  ]

  it('finds the exclusion containing t (start inclusive, end exclusive)', () => {
    expect(exclusionAtTime(exclusions, 12)?.id).toBe('b')
    expect(exclusionAtTime(exclusions, 10)?.id).toBe('b')
    expect(exclusionAtTime(exclusions, 20)).toBeUndefined()
  })

  it('returns undefined outside every exclusion', () => {
    expect(exclusionAtTime(exclusions, 7)).toBeUndefined()
  })
})
