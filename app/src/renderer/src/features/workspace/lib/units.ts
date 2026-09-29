import type { Calibration } from '../../../api/types'

/**
 * Unit conversions for the scale calibration feature (`docs/architecture.md` §4, `Calibration`).
 * Pure functions — no React, no store — used by the zone geometry fields (px/cm, `SelectedZonePanel`)
 * and the Measure tool's popover (mm/cm, `CalibrationPopover`).
 */

/** Unit the Setup inspector's zone geometry fields are shown in. */
export type ZoneUnit = 'px' | 'cm'

/** Unit the Measure tool's "how long is this line?" input is shown in (always stored as mm). */
export type MeasureUnit = 'mm' | 'cm'

/**
 * mm represented by one video px, derived from a calibration line's endpoints and its real
 * length — or `null` if there is no calibration (or it's degenerate: coincident endpoints).
 */
export function mmPerPxOf(
  calibration: Pick<Calibration, 'x1' | 'y1' | 'x2' | 'y2' | 'length_mm'> | null | undefined
): number | null {
  if (!calibration) return null
  const lengthPx = Math.hypot(calibration.x2 - calibration.x1, calibration.y2 - calibration.y1)
  return lengthPx > 0 ? calibration.length_mm / lengthPx : null
}

/** A video-px value in the given display unit (unchanged if `unit` is `'px'` or uncalibrated). */
export function pxToUnit(px: number, unit: ZoneUnit, mmPerPx: number | null): number {
  if (unit === 'px' || mmPerPx == null) return px
  return (px * mmPerPx) / 10
}

/** The inverse of `pxToUnit`: a display-unit value back to video px. */
export function unitToPx(value: number, unit: ZoneUnit, mmPerPx: number | null): number {
  if (unit === 'px' || mmPerPx == null) return value
  return (value * 10) / mmPerPx
}

/** mm → the Measure popover's display unit. */
export function mmToMeasureUnit(mm: number, unit: MeasureUnit): number {
  return unit === 'cm' ? mm / 10 : mm
}

/** The Measure popover's display unit → mm (what `Calibration.length_mm` stores). */
export function measureUnitToMm(value: number, unit: MeasureUnit): number {
  return unit === 'cm' ? value * 10 : value
}

/** Rounds a display value: whole px, or cm to 0.01 (mm precision). */
export function roundForUnit(value: number, unit: ZoneUnit): number {
  return unit === 'px' ? Math.round(value) : Math.round(value * 100) / 100
}

/**
 * A video-px² area in the given display unit (unchanged if `unit` is `'px'` or uncalibrated) —
 * used by the "Minimum mouse size" slider (`DetectionSection`). cm² = px² × (mm/px)² / 100.
 */
export function pxAreaToUnit(pxArea: number, unit: ZoneUnit, mmPerPx: number | null): number {
  if (unit === 'px' || mmPerPx == null) return pxArea
  return (pxArea * mmPerPx * mmPerPx) / 100
}

/** The inverse of `pxAreaToUnit`: a display-unit area back to video px². */
export function unitAreaToPx(value: number, unit: ZoneUnit, mmPerPx: number | null): number {
  if (unit === 'px' || mmPerPx == null) return value
  return (value * 100) / (mmPerPx * mmPerPx)
}

/** Rounds a display area: whole px², or cm² to 0.01. */
export function roundForAreaUnit(value: number, unit: ZoneUnit): number {
  return unit === 'px' ? Math.round(value) : Math.round(value * 100) / 100
}
