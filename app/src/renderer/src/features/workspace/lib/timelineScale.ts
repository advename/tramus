/** Pure time ↔ position math for the timeline ruler and lanes (video seconds, not frames). */

export interface TimelineTick {
  t: number
  major: boolean
  /** `"m:ss"`, only set for major ticks. */
  label: string
}

const NICE_STEPS_S = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

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

/** `t` (seconds) → a `left` CSS percentage string within a `durationS`-wide track. */
export function percentOfDuration(t: number, durationS: number): string {
  if (durationS <= 0) return '0%'
  return `${(t / durationS) * 100}%`
}

/** Pointer x (client px) → video time, clamped to `[0, durationS]`. */
export function timeAtClientX(clientX: number, trackRect: { left: number; width: number }, durationS: number): number {
  if (trackRect.width <= 0) return 0
  const fraction = (clientX - trackRect.left) / trackRect.width
  return Math.max(0, Math.min(durationS, fraction * durationS))
}
