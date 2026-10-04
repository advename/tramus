import { describe, expect, it } from 'vitest'

import { correctionsToReopen, nextUnresolvedFlag, previousUnresolvedFlag } from './flags'
import type { Correction, FlagView } from '../../../api/types'

function makeFlag(overrides: Partial<FlagView> = {}): FlagView {
  return {
    id: 'not_found-100',
    reason: 'not_found',
    frame_start: 100,
    frame_end: 120,
    t_start_s: 4,
    t_end_s: 4.8,
    detail: 'Lost for 0.8 s',
    metric: 0.8,
    status: 'fixed',
    ...overrides
  }
}

const base = { created_at: '2024-01-01T00:00:00Z' }

describe('correctionsToReopen', () => {
  it('includes the accept_flag targeting this flag', () => {
    const flag = makeFlag({ status: 'accepted' })
    const corrections: Correction[] = [
      { ...base, id: 'c1', kind: 'accept_flag', flag_id: flag.id },
      { ...base, id: 'c2', kind: 'accept_flag', flag_id: 'other-flag' }
    ]
    const plan = correctionsToReopen(flag, corrections)
    expect(plan.correctionIds).toEqual(['c1'])
    expect(plan.extendsBeyondFlag).toBe(false)
  })

  it('includes a set_position inside the flag range and excludes one outside it', () => {
    const flag = makeFlag()
    const corrections: Correction[] = [
      { ...base, id: 'inside', kind: 'set_position', frame: 110, x: 1, y: 1 },
      { ...base, id: 'outside', kind: 'set_position', frame: 5, x: 1, y: 1 }
    ]
    const plan = correctionsToReopen(flag, corrections)
    expect(plan.correctionIds).toEqual(['inside'])
    expect(plan.extendsBeyondFlag).toBe(false)
  })

  it('includes a mark_hidden/interpolate range fully inside the flag without flagging extension', () => {
    const flag = makeFlag()
    const corrections: Correction[] = [
      { ...base, id: 'c1', kind: 'interpolate', frame_start: 105, frame_end: 115 }
    ]
    const plan = correctionsToReopen(flag, corrections)
    expect(plan.correctionIds).toEqual(['c1'])
    expect(plan.extendsBeyondFlag).toBe(false)
  })

  it('removes a correction that only partly overlaps and flags that it extends beyond', () => {
    const flag = makeFlag()
    const corrections: Correction[] = [
      { ...base, id: 'long', kind: 'interpolate', frame_start: 90, frame_end: 200 }
    ]
    const plan = correctionsToReopen(flag, corrections)
    expect(plan.correctionIds).toEqual(['long'])
    expect(plan.extendsBeyondFlag).toBe(true)
  })

  it('excludes a mark_hidden range that does not overlap the flag at all', () => {
    const flag = makeFlag()
    const corrections: Correction[] = [
      { ...base, id: 'c1', kind: 'mark_hidden', frame_start: 0, frame_end: 50 },
      { ...base, id: 'c2', kind: 'mark_hidden', frame_start: 200, frame_end: 250 }
    ]
    const plan = correctionsToReopen(flag, corrections)
    expect(plan.correctionIds).toEqual([])
    expect(plan.extendsBeyondFlag).toBe(false)
  })

  it('touches ranges that only share an endpoint frame', () => {
    const flag = makeFlag()
    const corrections: Correction[] = [
      { ...base, id: 'c1', kind: 'mark_hidden', frame_start: 120, frame_end: 130 }
    ]
    const plan = correctionsToReopen(flag, corrections)
    expect(plan.correctionIds).toEqual(['c1'])
    expect(plan.extendsBeyondFlag).toBe(true)
  })
})

describe('nextUnresolvedFlag', () => {
  it('finds the next unresolved flag after the current frame, skipping resolved ones', () => {
    const flags = [
      makeFlag({ id: 'f1', frame_start: 10, status: 'fixed' }),
      makeFlag({ id: 'f2', frame_start: 50, status: 'unresolved' }),
      makeFlag({ id: 'f3', frame_start: 100, status: 'accepted' }),
      makeFlag({ id: 'f4', frame_start: 150, status: 'unresolved' })
    ]
    expect(nextUnresolvedFlag(flags, 20)?.id).toBe('f2')
    expect(nextUnresolvedFlag(flags, 60)?.id).toBe('f4')
  })

  it('wraps to the first unresolved flag past the last one', () => {
    const flags = [
      makeFlag({ id: 'f1', frame_start: 10, status: 'unresolved' }),
      makeFlag({ id: 'f2', frame_start: 150, status: 'unresolved' })
    ]
    expect(nextUnresolvedFlag(flags, 200)?.id).toBe('f1')
  })

  it('excludes the flag just accepted, even though its status in `flags` may still be unresolved', () => {
    const flags = [
      makeFlag({ id: 'f1', frame_start: 10, status: 'unresolved' }),
      makeFlag({ id: 'f2', frame_start: 150, status: 'unresolved' })
    ]
    expect(nextUnresolvedFlag(flags, 200, 'f2')?.id).toBe('f1')
  })

  it('returns undefined when the just-accepted flag was the only unresolved one', () => {
    const flags = [
      makeFlag({ id: 'f1', frame_start: 10, status: 'unresolved' }),
      makeFlag({ id: 'f2', frame_start: 150, status: 'fixed' })
    ]
    expect(nextUnresolvedFlag(flags, 20, 'f1')).toBeUndefined()
  })

  it('returns undefined when there are no unresolved flags at all', () => {
    const flags = [makeFlag({ id: 'f1', frame_start: 10, status: 'fixed' })]
    expect(nextUnresolvedFlag(flags, 20)).toBeUndefined()
  })
})

describe('previousUnresolvedFlag', () => {
  const flags = [
    makeFlag({ id: 'f1', frame_start: 10, status: 'unresolved' }),
    makeFlag({ id: 'f2', frame_start: 100, status: 'fixed' }),
    makeFlag({ id: 'f3', frame_start: 150, status: 'unresolved' })
  ]

  it('skips resolved flags', () => {
    expect(previousUnresolvedFlag(flags, 120)?.id).toBe('f1')
  })

  it('wraps to the last unresolved flag before the first one', () => {
    expect(previousUnresolvedFlag(flags, 5)?.id).toBe('f3')
  })

  it('returns undefined when nothing is unresolved', () => {
    expect(previousUnresolvedFlag([makeFlag({ status: 'accepted' })], 5)).toBeUndefined()
  })
})
