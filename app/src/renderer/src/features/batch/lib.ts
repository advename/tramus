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

export interface BatchProgress {
  /** Σ frames_done / Σ frames_total over succeeded, queued and running jobs, 0–1. */
  fraction: number
  /** Frames still to track across those jobs. */
  remainingFrames: number
  /** Combined current throughput of the running jobs (Σ fps), frames per second. */
  fps: number
}

/**
 * Whole-batch progress. A succeeded job counts as fully done; failed and cancelled jobs are left
 * out of both sums, since they will never contribute more frames.
 */
export function batchProgress(jobs: readonly Job[]): BatchProgress {
  let done = 0
  let total = 0
  let fps = 0
  for (const job of jobs) {
    if (job.state === 'failed' || job.state === 'cancelled') continue
    total += job.frames_total
    done +=
      job.state === 'succeeded' ? job.frames_total : Math.min(job.frames_done, job.frames_total)
    if (job.state === 'running') fps += job.fps ?? 0
  }
  return { fraction: total > 0 ? done / total : 0, remainingFrames: total - done, fps }
}

/** Weight of the newest throughput sample in `smoothThroughput`. */
const THROUGHPUT_SMOOTHING = 0.2

/** Exponential moving average of the batch throughput; `previous` is `null` before the first
 * sample. Smoothing the rate (not the resulting ETA) keeps the countdown from jumping when a
 * job starts or finishes. */
export function smoothThroughput(previous: number | null, sample: number): number {
  return previous == null ? sample : previous + THROUGHPUT_SMOOTHING * (sample - previous)
}

/** Seconds until the batch finishes at `fps` frames per second, or `null` while there is no
 * throughput estimate yet ("Estimating…"). */
export function batchRemainingSeconds(remainingFrames: number, fps: number | null): number | null {
  if (remainingFrames <= 0) return 0
  return fps != null && fps > 0 ? remainingFrames / fps : null
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
