import type { Setup, TrialWindow } from '../../../api/types'
import { videoDuration } from './frames'

/** A setup with neither an arena nor any zones — the design's "no setup yet" state. */
export function isSetupEmpty(setup: Setup | undefined): boolean {
  if (!setup) return true
  return !setup.arena && (setup.zones?.length ?? 0) === 0
}

/** The trial window, defaulting to the whole video when the setup doesn't set one. */
export function effectiveTrial(setup: Setup | undefined, frameTimes: Float64Array): TrialWindow {
  if (setup?.trial) return setup.trial
  return { start_s: 0, end_s: videoDuration(frameTimes), locked_duration: false }
}

export type SaveDotColor = 'warning' | 'success'

export interface SaveLabelInfo {
  label: string
  dot: SaveDotColor
}

function formatLocalTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso)
  )
}

function formatLocalDateTime(iso: string): string {
  const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(iso)
  )
  return `${date} ${formatLocalTime(iso)}`
}

/**
 * The top bar's save-state label and dot colour (design states: "Not saved yet", "Unsaved
 * changes", "Saved HH:MM", "Loaded · saved <date>").
 */
export function saveLabel(session: {
  dirty: boolean
  saved_at: string | null
  loaded_from_disk: boolean
}): SaveLabelInfo {
  if (session.dirty) return { label: 'Unsaved changes', dot: 'warning' }
  if (session.loaded_from_disk && session.saved_at) {
    return { label: `Loaded · saved ${formatLocalDateTime(session.saved_at)}`, dot: 'success' }
  }
  if (session.saved_at) return { label: `Saved ${formatLocalTime(session.saved_at)}`, dot: 'success' }
  return { label: 'Not saved yet', dot: 'warning' }
}

/**
 * Rough estimate of how long tracking a trial of this duration will take, for the Track button's
 * hint ("Trial 5:00.000 · about N s"). The engine doesn't expose a benchmark, so this uses the
 * background-subtraction tracker's validated throughput (`docs/architecture.md` §5.1) as a
 * conservative guess.
 */
const ESTIMATED_TRACKING_FPS = 300

export function estimateTrackingSeconds(trialDurationS: number, nominalFps: number): number {
  const frames = trialDurationS * nominalFps
  return Math.max(1, Math.round(frames / ESTIMATED_TRACKING_FPS))
}
