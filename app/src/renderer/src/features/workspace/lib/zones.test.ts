import { describe, expect, it } from 'vitest'

import { nextBulkToggle } from './zones'
import type { Zone } from '../../../api/types'

function makeZone(overrides: Partial<Zone>): Zone {
  return {
    id: 'z1',
    name: 'Zone',
    color_index: 0,
    shape: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    visible: true,
    locked: false,
    ...overrides
  }
}

describe('nextBulkToggle', () => {
  it('turns the flag on when no zone has it (show/lock all)', () => {
    const zones = [makeZone({ id: 'a', visible: false }), makeZone({ id: 'b', visible: false })]
    expect(nextBulkToggle(zones, 'visible')).toBe(true)
  })

  it('turns the flag off when any zone has it (hide/unlock all)', () => {
    const zones = [makeZone({ id: 'a', visible: false }), makeZone({ id: 'b', visible: true })]
    expect(nextBulkToggle(zones, 'visible')).toBe(false)
  })

  it('turns the flag off when every zone already has it', () => {
    const zones = [makeZone({ id: 'a', visible: true }), makeZone({ id: 'b', visible: true })]
    expect(nextBulkToggle(zones, 'visible')).toBe(false)
  })

  it('works independently for the locked flag', () => {
    const zones = [makeZone({ id: 'a', locked: true }), makeZone({ id: 'b', locked: false })]
    expect(nextBulkToggle(zones, 'locked')).toBe(false)
  })

  it('defaults to turning the flag on for an empty zone list', () => {
    expect(nextBulkToggle([], 'visible')).toBe(true)
  })
})
