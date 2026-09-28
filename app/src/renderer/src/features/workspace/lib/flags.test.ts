import { describe, expect, it } from 'vitest'

import { correctionsToReopen } from './flags'
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
