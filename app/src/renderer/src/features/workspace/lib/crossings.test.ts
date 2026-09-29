import { describe, expect, it } from 'vitest'

import type { CrossingResult, CrossingRule, MatrixCell, Zone } from '../../../api/types'
import {
  ANY_ZONE_LABEL,
  defaultCrossingRule,
  findRuleForPair,
  heatIntensity,
  matrixCount,
  maxMatrixCount,
  newCrossingRuleId,
  resultForRule,
  zoneColorIndex,
  zoneLabel
} from './crossings'

function makeZone(overrides: Partial<Zone> = {}): Zone {
  return {
    id: 'z1',
    name: 'Center',
    color_index: 0,
    visible: true,
    locked: false,
    shape: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    ...overrides
  }
}

describe('newCrossingRuleId', () => {
  it('returns a 12 hex char id', () => {
    const id = newCrossingRuleId()
    expect(id).toMatch(/^[0-9a-f]{12}$/)
  })

  it('is different on every call', () => {
    expect(newCrossingRuleId()).not.toBe(newCrossingRuleId())
  })
})

describe('zoneLabel', () => {
  const zones = [makeZone({ id: 'z1', name: 'Center' }), makeZone({ id: 'z2', name: 'Corner' })]

  it('returns the matching zone name', () => {
    expect(zoneLabel(zones, 'z2')).toBe('Corner')
  })

  it('returns "Any zone" for null/undefined', () => {
    expect(zoneLabel(zones, null)).toBe(ANY_ZONE_LABEL)
    expect(zoneLabel(zones, undefined)).toBe(ANY_ZONE_LABEL)
  })

  it('falls back to "Any zone" for an id that no longer exists', () => {
    expect(zoneLabel(zones, 'gone')).toBe(ANY_ZONE_LABEL)
  })
})

describe('zoneColorIndex', () => {
  const zones = [makeZone({ id: 'z1', color_index: 3 })]

  it('returns the zone color index', () => {
    expect(zoneColorIndex(zones, 'z1')).toBe(3)
  })

  it('returns null for "Any zone" or an unknown id', () => {
    expect(zoneColorIndex(zones, null)).toBeNull()
    expect(zoneColorIndex(zones, 'gone')).toBeNull()
  })
})

describe('defaultCrossingRule', () => {
  it('defaults from/to to the first two zones', () => {
    const zones = [makeZone({ id: 'a' }), makeZone({ id: 'b' }), makeZone({ id: 'c' })]
    const rule = defaultCrossingRule(zones)
    expect(rule.from_zone_id).toBe('a')
    expect(rule.to_zone_id).toBe('b')
    expect(rule.id).toMatch(/^[0-9a-f]{12}$/)
  })

  it('picks the first pair no existing rule covers', () => {
    const zones = [makeZone({ id: 'a' }), makeZone({ id: 'b' }), makeZone({ id: 'c' })]
    const existing = [
      { id: 'r1', from_zone_id: 'a', to_zone_id: 'b' },
      { id: 'r2', from_zone_id: 'a', to_zone_id: 'c' }
    ]
    const rule = defaultCrossingRule(zones, existing)
    expect([rule.from_zone_id, rule.to_zone_id]).toEqual(['b', 'a'])
  })
})

describe('resultForRule', () => {
  const crossings: CrossingResult[] = [
    { rule_id: 'r1', from_zone_id: 'a', to_zone_id: 'b', count: 4, events: [] },
    { rule_id: 'r2', from_zone_id: null, to_zone_id: null, count: 9, events: [] }
  ]

  it('finds the matching result by rule id', () => {
    expect(resultForRule(crossings, 'r2')?.count).toBe(9)
  })

  it('returns undefined when missing or crossings is undefined', () => {
    expect(resultForRule(crossings, 'nope')).toBeUndefined()
    expect(resultForRule(undefined, 'r1')).toBeUndefined()
  })
})

describe('matrixCount / maxMatrixCount', () => {
  const matrix: MatrixCell[] = [
    { from_zone_id: 'a', to_zone_id: 'b', count: 5 },
    { from_zone_id: 'a', to_zone_id: 'a', count: 2 },
    { from_zone_id: 'b', to_zone_id: 'a', count: 8 }
  ]

  it('finds the count for an ordered pair', () => {
    expect(matrixCount(matrix, 'a', 'b')).toBe(5)
    expect(matrixCount(matrix, 'b', 'a')).toBe(8)
  })

  it('returns 0 for a missing pair or an undefined matrix', () => {
    expect(matrixCount(matrix, 'a', 'c')).toBe(0)
    expect(matrixCount(undefined, 'a', 'b')).toBe(0)
  })

  it('finds the highest count in the matrix', () => {
    expect(maxMatrixCount(matrix)).toBe(8)
  })

  it('is 0 for an empty or undefined matrix', () => {
    expect(maxMatrixCount([])).toBe(0)
    expect(maxMatrixCount(undefined)).toBe(0)
  })
})

describe('heatIntensity', () => {
  it('is proportional to the matrix max', () => {
    expect(heatIntensity(4, 8)).toBe(0.5)
    expect(heatIntensity(8, 8)).toBe(1)
  })

  it('is 0 for a zero count or an empty matrix', () => {
    expect(heatIntensity(0, 8)).toBe(0)
    expect(heatIntensity(4, 0)).toBe(0)
  })
})

describe('findRuleForPair', () => {
  const rules: CrossingRule[] = [
    { id: 'r1', from_zone_id: 'a', to_zone_id: 'b' },
    { id: 'r2', from_zone_id: null, to_zone_id: 'b' }
  ]

  it('finds a rule matching both concrete sides exactly', () => {
    expect(findRuleForPair(rules, 'a', 'b')?.id).toBe('r1')
  })

  it('does not match a wildcard rule against a concrete pair', () => {
    expect(findRuleForPair(rules, 'x', 'b')).toBeUndefined()
  })
})
