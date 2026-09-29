import type {
  AppSettings,
  BatchCheckItem,
  BatchItemView,
  Job,
  JobState,
  Shape
} from '../../api/types'
import { TERMINAL_JOB_STATES } from '../../api/queries'

/** Maps a template shape (drawn in reference-frame px) into a specific video's px space. */
export function scaleShape(shape: Shape, scaleX: number, scaleY: number): Shape {
  switch (shape.kind) {
    case 'rect':
      return {
        ...shape,
        x: shape.x * scaleX,
        y: shape.y * scaleY,
        width: shape.width * scaleX,
        height: shape.height * scaleY
      }
    case 'ellipse':
      return {
        ...shape,
        cx: shape.cx * scaleX,
        cy: shape.cy * scaleY,
        rx: shape.rx * scaleX,
        ry: shape.ry * scaleY
      }
    case 'polygon':
      return {
        ...shape,
        points: shape.points.map((point) => [(point[0] ?? 0) * scaleX, (point[1] ?? 0) * scaleY])
      }
  }
}

export type BatchStep = 'choose' | 'check' | 'run' | 'finish'

/** Per-video editable state for the Check step, seeded from a `BatchCheckItem`. */
export interface CheckDraft {
  videoId: string
  fileName: string
  durationS: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  warnings: string[]
  included: boolean
  offsetX: number
  offsetY: number
  trialStart: number
  trialEnd: number
}

export function buildCheckDraft(item: BatchCheckItem): CheckDraft {
  const start = item.suggested_trial?.[0] ?? 0
  const end = item.suggested_trial?.[1] ?? item.duration_s
  return {
    videoId: item.video_id,
    fileName: item.file_name,
    durationS: item.duration_s,
    width: item.width,
    height: item.height,
    scaleX: item.scale_x,
    scaleY: item.scale_y,
    warnings: item.warnings,
    included: true,
    offsetX: 0,
    offsetY: 0,
    trialStart: Math.max(0, Math.min(start, item.duration_s)),
    trialEnd: Math.max(0, Math.min(end, item.duration_s))
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function signed(value: number): string {
  const rounded = Math.round(value)
  if (rounded === 0) return '0'
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`
}

/** `"Drag to nudge"` when there's no offset yet, else `"Offset +6, −3 px"`. */
export function formatOffset(offsetX: number, offsetY: number): string {
  if (Math.round(offsetX) === 0 && Math.round(offsetY) === 0) return 'Drag to nudge'
  return `Offset ${signed(offsetX)}, ${signed(offsetY)} px`
}

export interface JobCounts {
  total: number
  done: number
  running: number
  waiting: number
  cancelled: number
  failed: number
}

const DONE_STATES: ReadonlySet<JobState> = new Set(['succeeded'])

export function summarizeJobs(jobs: Job[]): JobCounts {
  const counts: JobCounts = {
    total: jobs.length,
    done: 0,
    running: 0,
    waiting: 0,
    cancelled: 0,
    failed: 0
  }
  for (const job of jobs) {
    if (DONE_STATES.has(job.state)) counts.done += 1
    else if (job.state === 'running') counts.running += 1
    else if (job.state === 'queued') counts.waiting += 1
    else if (job.state === 'cancelled') counts.cancelled += 1
    else if (job.state === 'failed') counts.failed += 1
  }
  return counts
}

export function allTerminal(jobs: Job[]): boolean {
  return jobs.length > 0 && jobs.every((job) => TERMINAL_JOB_STATES.has(job.state))
}

/** Average progress across all jobs in the batch, 0–1. */
export function overallProgress(jobs: Job[]): number {
  if (jobs.length === 0) return 0
  const sum = jobs.reduce(
    (total, job) => total + (TERMINAL_JOB_STATES.has(job.state) ? 1 : job.progress),
    0
  )
  return sum / jobs.length
}

/** Sum of `remaining_s` across running jobs, or `null` if none report one yet. */
export function remainingSeconds(jobs: Job[]): number | null {
  const running = jobs.filter((job) => job.state === 'running' && job.remaining_s != null)
  if (running.length === 0) return null
  return running.reduce((total, job) => total + (job.remaining_s ?? 0), 0)
}

/** `"GPU · NVIDIA RTX A2000"` / `"GPU"` / `"CPU"` for the Run step's device line. */
export function deviceLabel(device: AppSettings['device'], gpuName: string | undefined): string {
  const usesGpu = device === 'gpu' || (device === 'auto' && Boolean(gpuName))
  if (usesGpu) return gpuName ? `GPU · ${gpuName}` : 'GPU'
  return 'CPU'
}

/** The largest frame index whose time is `<= t` (binary search; `frameTimes` is sorted). Frame 0
 * for `t <= frameTimes[0]`, the last frame for `t >= frameTimes[frameTimes.length - 1]`. */
export function indexAtTime(frameTimes: Float64Array, t: number): number {
  if (frameTimes.length === 0) return 0
  let lo = 0
  let hi = frameTimes.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frameTimes[mid]! <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** A saved batch's per-video row status for the Finish overview — one of a handful of mutually
 * exclusive states, in priority order: a live job (still queued/running/just failed/cancelled)
 * wins over the sidecar-derived `status`, since it's the more current signal. */
export type BatchRowStatus =
  | { kind: 'queued' }
  | { kind: 'tracking'; progress: number; fps: number | null; remainingS: number | null }
  | { kind: 'failed'; error: string | null }
  | { kind: 'cancelled' }
  | { kind: 'flags'; count: number }
  | { kind: 'reviewed' }
  | { kind: 'not_tracked' }

export function batchRowStatus(item: BatchItemView): BatchRowStatus {
  const job = item.job
  if (job) {
    if (job.state === 'queued') return { kind: 'queued' }
    if (job.state === 'running') {
      return {
        kind: 'tracking',
        progress: job.progress,
        fps: job.fps ?? null,
        remainingS: job.remaining_s ?? null
      }
    }
    if (job.state === 'failed') return { kind: 'failed', error: job.error ?? null }
    if (job.state === 'cancelled') return { kind: 'cancelled' }
  }
  if (item.status === 'tracked') return { kind: 'flags', count: item.unresolved_flags }
  if (item.status === 'reviewed' || item.status === 'exported') return { kind: 'reviewed' }
  return { kind: 'not_tracked' }
}

/** Whether any item in a saved batch still has a job that hasn't reached a terminal state — the
 * Batch screen shows Run while this is true, Finish otherwise. */
export function batchIsRunning(items: BatchItemView[]): boolean {
  return items.some((item) => item.job != null && !TERMINAL_JOB_STATES.has(item.job.state))
}
