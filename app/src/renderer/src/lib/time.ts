/**
 * Time/date formatting helpers. Every numeric readout that comes from these should be rendered
 * with the `mono` typography variant (see `theme/createAppTheme.ts`) so digits don't shift
 * during playback.
 *
 * Per `docs/architecture.md` §3: video time is derived from frame presentation timestamps, never
 * `frameIndex / fps` (recordings are variable frame rate). These helpers only format seconds —
 * they don't compute them.
 */

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

/** `123.4567` → `"02:03.457"` (mm:ss.mmm). For a video-time readout, e.g. the playhead. */
export function formatVideoTime(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const totalMs = Math.round(abs * 1000)
  const m = Math.floor(totalMs / 60_000)
  const s = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  return `${sign}${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

/** `123.4567` → `"2:03.457"` (m:ss.mmm, no leading zero on minutes). For a duration readout. */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const totalMs = Math.round(abs * 1000)
  const m = Math.floor(totalMs / 60_000)
  const s = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  return `${sign}${m}:${pad(s)}.${pad(ms, 3)}`
}

/** `123.4567` → `"2:03"` (m:ss, no milliseconds). For a compact duration, e.g. a library row. */
export function formatShortDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const totalS = Math.round(abs)
  const m = Math.floor(totalS / 60)
  const s = totalS % 60
  return `${sign}${m}:${pad(s)}`
}

export interface FormatClockTimeOptions {
  /** Include milliseconds (`HH:MM:SS.mmm` instead of `HH:MM:SS`). Default false. */
  ms?: boolean
}

/**
 * `recordedAtUtcIso` (the video's `recorded_at`, UTC ISO-8601) + `offsetS` (video time) → the
 * wall-clock time, formatted in the computer's local time zone. Used everywhere the UI shows
 * "clock time" next to video time (flags, zone visits, the timeline).
 */
export function formatClockTime(
  recordedAtUtcIso: string,
  offsetS: number,
  options: FormatClockTimeOptions = {}
): string {
  const at = new Date(recordedAtUtcIso).getTime() + offsetS * 1000
  const date = new Date(at)
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const base = formatter.format(date)
  if (!options.ms) return base
  return `${base}.${pad(date.getMilliseconds(), 3)}`
}

/** `recordedAtUtcIso` → a local-date readout, e.g. `"25 Sep 2026"`. */
export function formatDate(recordedAtUtcIso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(recordedAtUtcIso))
}

/** `9000` → `"9 000"` — a space thousands separator, matching the design's frame counts. */
export function formatFrameCount(frameCount: number): string {
  return Math.round(frameCount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * `recordedAtUtcIso` → `"Today"` / `"Yesterday"` / `"18 Sep"` (`"18 Sep 2025"` if not this year).
 * Used for the Start screen's recent-folders list ("when it was last opened").
 */
export function formatRelativeDate(utcIso: string): string {
  const date = new Date(utcIso)
  const now = new Date()
  const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  }).format(date)
}

/**
 * `100` → `"1 min 40 s"`, `45` → `"45 s"`, `7530` → `"2 h 5 min"`. A compact "time remaining"
 * readout — for `mm:ss` use `formatShortDuration` instead.
 */
export function formatSecondsCompact(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min ${s} s`
  return `${s} s`
}
