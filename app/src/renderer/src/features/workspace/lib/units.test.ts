import { describe, expect, it } from 'vitest'

import {
  measureUnitToMm,
  mmPerPxOf,
  mmToMeasureUnit,
  pxAreaToUnit,
  pxToUnit,
  roundForAreaUnit,
  roundForUnit,
  unitAreaToPx,
  unitToPx
} from './units'

describe('mmPerPxOf', () => {
  it('derives mm-per-px from a horizontal calibration line', () => {
    const calibration = { x1: 0, y1: 0, x2: 100, y2: 0, length_mm: 50 }
    expect(mmPerPxOf(calibration)).toBe(0.5)
  })

  it('derives mm-per-px from a diagonal line', () => {
    const calibration = { x1: 0, y1: 0, x2: 3, y2: 4, length_mm: 10 }
    expect(mmPerPxOf(calibration)).toBe(2)
  })

  it('is null without a calibration', () => {
    expect(mmPerPxOf(null)).toBeNull()
    expect(mmPerPxOf(undefined)).toBeNull()
  })

  it('is null for a degenerate (zero-length) line', () => {
    expect(mmPerPxOf({ x1: 5, y1: 5, x2: 5, y2: 5, length_mm: 50 })).toBeNull()
  })
})

describe('pxToUnit / unitToPx', () => {
  const mmPerPx = 0.5 // 1 px = 0.5 mm = 0.05 cm

  it('passes px through unchanged', () => {
    expect(pxToUnit(120, 'px', mmPerPx)).toBe(120)
    expect(unitToPx(120, 'px', mmPerPx)).toBe(120)
  })

  it('converts px to cm using mm-per-px', () => {
    expect(pxToUnit(100, 'cm', mmPerPx)).toBe(5) // 100 px * 0.5 mm/px = 50 mm = 5 cm
  })

  it('converts cm back to px', () => {
    expect(unitToPx(5, 'cm', mmPerPx)).toBe(100)
  })

  it('is a round trip', () => {
    const px = 237
    expect(unitToPx(pxToUnit(px, 'cm', mmPerPx), 'cm', mmPerPx)).toBeCloseTo(px)
  })

  it('falls back to px when uncalibrated', () => {
    expect(pxToUnit(42, 'cm', null)).toBe(42)
    expect(unitToPx(42, 'cm', null)).toBe(42)
  })
})

describe('mmToMeasureUnit / measureUnitToMm', () => {
  it('passes mm through unchanged', () => {
    expect(mmToMeasureUnit(50, 'mm')).toBe(50)
    expect(measureUnitToMm(50, 'mm')).toBe(50)
  })

  it('converts mm to/from cm', () => {
    expect(mmToMeasureUnit(50, 'cm')).toBe(5)
    expect(measureUnitToMm(5, 'cm')).toBe(50)
  })
})

describe('roundForUnit', () => {
  it('rounds px to whole numbers', () => {
    expect(roundForUnit(12.6, 'px')).toBe(13)
  })

  it('rounds cm to two decimals', () => {
    expect(roundForUnit(1.23456, 'cm')).toBe(1.23)
  })
})

describe('pxAreaToUnit / unitAreaToPx', () => {
  const mmPerPx = 0.5 // 1 px = 0.5 mm, so 1 px² = 0.25 mm² = 0.0025 cm²

  it('passes px² through unchanged', () => {
    expect(pxAreaToUnit(300, 'px', mmPerPx)).toBe(300)
    expect(unitAreaToPx(300, 'px', mmPerPx)).toBe(300)
  })

  it('converts px² to cm² using (mm/px)²', () => {
    // 400 px² * 0.25 mm²/px² = 100 mm² = 1 cm²
    expect(pxAreaToUnit(400, 'cm', mmPerPx)).toBe(1)
  })

  it('converts cm² back to px²', () => {
    expect(unitAreaToPx(1, 'cm', mmPerPx)).toBe(400)
  })

  it('is a round trip', () => {
    const px = 317
    expect(unitAreaToPx(pxAreaToUnit(px, 'cm', mmPerPx), 'cm', mmPerPx)).toBeCloseTo(px)
  })

  it('falls back to px² when uncalibrated', () => {
    expect(pxAreaToUnit(300, 'cm', null)).toBe(300)
    expect(unitAreaToPx(300, 'cm', null)).toBe(300)
  })
})

describe('roundForAreaUnit', () => {
  it('rounds px² to whole numbers', () => {
    expect(roundForAreaUnit(299.6, 'px')).toBe(300)
  })

  it('rounds cm² to two decimals', () => {
    expect(roundForAreaUnit(0.38456, 'cm')).toBe(0.38)
  })
})
