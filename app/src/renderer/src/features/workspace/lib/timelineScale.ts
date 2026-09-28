/** Pure time ↔ position math for the timeline ruler and lanes (video seconds, not frames). */

export interface TimelineTick {
  t: number
  major: boolean
  /** `"m:ss"`, only set for major ticks. */
  label: string
}

const NICE_STEPS_S = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

/**
 * Horizontal margin (px) reserved on each side of the track content so things drawn at 0% or
 * 100% of the duration — the trial start/end handles, in particular — aren't flush against the
 * scrolling track container's edge and clipped by its `overflow-x: auto`.
 */
export const TIMELINE_GUTTER_PX = 14

/** The smallest "nice" step (seconds) that keeps ticks at least `minPxBetween` apart. */
export function pickTickStep(pxPerSecond: number, minPxBetween: number): number {
  if (pxPerSecond <= 0) return NICE_STEPS_S[NICE_STEPS_S.length - 1]!
  for (const step of NICE_STEPS_S) {
    if (step * pxPerSecond >= minPxBetween) return step
  }
  return NICE_STEPS_S[NICE_STEPS_S.length - 1]!
}

function formatTickLabel(t: number): string {
  const totalS = Math.round(t)
  const m = Math.floor(totalS / 60)
  const s = totalS % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Minor + major ruler ticks covering `[0, durationS]`, spaced for the given pixel density. */
export function buildTicks(durationS: number, pxPerSecond: number): TimelineTick[] {
  if (durationS <= 0 || !Number.isFinite(pxPerSecond)) return []
  const minor = pickTickStep(pxPerSecond, 40)
  const major = pickTickStep(pxPerSecond, 90)
  const ticks: TimelineTick[] = []
  const steps = Math.floor(durationS / minor + 1e-6)
  for (let i = 0; i <= steps; i++) {
    const t = Math.round(i * minor * 1000) / 1000
    const isMajor = Math.abs(t % major) < 1e-6 || major - (t % major) < 1e-6
    ticks.push({ t, major: isMajor, label: isMajor ? formatTickLabel(t) : '' })
  }
  return ticks
}

/**
 * `t` (seconds) → a `left` CSS value within a `durationS`-wide track, leaving `gutterPx` of room
 * on each side (see `TIMELINE_GUTTER_PX`). `t = 0` lands at `gutterPx`, `t = durationS` lands at
 * `calc(100% - gutterPx)`. Also correct as a `width` for an element already positioned at `left:
 * 0` (e.g. the "before trial start" dim overlay) — its right edge should land exactly on this
 * same position. For a width between two arbitrary times, use `widthOfDuration` instead: a plain
 * position formula double-counts the gutter if used as a width.
 */
export function percentOfDuration(
  t: number,
  durationS: number,
  gutterPx: number = TIMELINE_GUTTER_PX
): string {
  if (durationS <= 0) return `${gutterPx}px`
  const fraction = Math.max(0, Math.min(1, t / durationS))
  return `calc(${gutterPx}px + (100% - ${2 * gutterPx}px) * ${fraction})`
}

/**
 * `deltaS` (seconds, a duration rather than a point in time) → a `width` CSS value within a
 * `durationS`-wide track that reserves `gutterPx` on each side. Unlike `percentOfDuration`, this
 * has no constant offset — pair it with `left: percentOfDuration(startS, durationS)`.
 */
export function widthOfDuration(
  deltaS: number,
  durationS: number,
  gutterPx: number = TIMELINE_GUTTER_PX
): string {
  if (durationS <= 0) return '0px'
  const fraction = Math.max(0, Math.min(1, deltaS / durationS))
  return `calc((100% - ${2 * gutterPx}px) * ${fraction})`
}

/** Pointer x (client px) → video time, clamped to `[0, durationS]`. Inverse of `percentOfDuration`. */
export function timeAtClientX(
  clientX: number,
  trackRect: { left: number; width: number },
  durationS: number,
  gutterPx: number = TIMELINE_GUTTER_PX
): number {
  const usableWidth = trackRect.width - 2 * gutterPx
  if (usableWidth <= 0) return 0
  const fraction = (clientX - trackRect.left - gutterPx) / usableWidth
  return Math.max(0, Math.min(durationS, fraction * durationS))
}
