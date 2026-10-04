import { describe, expect, it } from 'vitest'

import type { BatchItemView, Job } from '../../api/types'
import {
  batchIsRunning,
  batchProgress,
  batchRemainingSeconds,
  batchRowStatus,
  indexAtTime,
  smoothThroughput
} from './lib'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job1',
    kind: 'track',
    video_id: 'v1',
    video_name: 'v1.mp4',
    batch_id: 'b1',
    state: 'running',
    progress: 0.5,
    frames_done: 50,
    frames_total: 100,
    fps: 120,
    elapsed_s: 1,
    remaining_s: 1,
    error: null,
    flag_count: null,
    created_at: '2026-01-01T00:00:00Z',
    started_at: '2026-01-01T00:00:00Z',
    finished_at: null,
    ...overrides
  }
}

function makeItem(overrides: Partial<BatchItemView> = {}): BatchItemView {
  return {
    video_id: 'v1',
    video_path: '/videos/v1.mp4',
    file_name: 'v1.mp4',
    trial: null,
    offset_x: 0,
    offset_y: 0,
    status: 'new',
    unresolved_flags: 0,
    job: null,
    ...overrides
  }
}

describe('indexAtTime', () => {
  const times = Float64Array.from([0, 0.04, 0.08, 0.12, 0.16])

  it('returns 0 for a time at or before the first frame', () => {
    expect(indexAtTime(times, -1)).toBe(0)
    expect(indexAtTime(times, 0)).toBe(0)
  })

  it('returns the last frame index for a time at or after the end', () => {
    expect(indexAtTime(times, 0.16)).toBe(4)
    expect(indexAtTime(times, 99)).toBe(4)
  })

  it('finds the largest frame index whose time is <= t', () => {
    expect(indexAtTime(times, 0.09)).toBe(2)
    expect(indexAtTime(times, 0.1199)).toBe(2)
    expect(indexAtTime(times, 0.12)).toBe(3)
  })

  it('handles an empty array', () => {
    expect(indexAtTime(Float64Array.from([]), 1)).toBe(0)
  })
})

describe('batchRowStatus', () => {
  it('reports a running job as tracking progress', () => {
    const status = batchRowStatus(makeItem({ job: makeJob({ state: 'running', progress: 0.42 }) }))
    expect(status).toEqual({ kind: 'tracking', progress: 0.42, fps: 120, remainingS: 1 })
  })

  it('reports a queued job before its status is checked', () => {
    expect(batchRowStatus(makeItem({ job: makeJob({ state: 'queued' }) }))).toEqual({
      kind: 'queued'
    })
  })

  it('reports a failed job with its error, even over a stale "new" status', () => {
    const status = batchRowStatus(
      makeItem({ status: 'new', job: makeJob({ state: 'failed', error: 'No mouse found' }) })
    )
    expect(status).toEqual({ kind: 'failed', error: 'No mouse found' })
  })

  it('reports a cancelled job', () => {
    expect(batchRowStatus(makeItem({ job: makeJob({ state: 'cancelled' }) }))).toEqual({
      kind: 'cancelled'
    })
  })

  it('falls back to the sidecar status once the job is gone (e.g. after a restart)', () => {
    expect(batchRowStatus(makeItem({ status: 'tracked', unresolved_flags: 3, job: null }))).toEqual(
      { kind: 'flags', count: 3 }
    )
    expect(batchRowStatus(makeItem({ status: 'reviewed', job: null }))).toEqual({
      kind: 'reviewed'
    })
    expect(batchRowStatus(makeItem({ status: 'exported', job: null }))).toEqual({
      kind: 'reviewed'
    })
    expect(batchRowStatus(makeItem({ status: 'set_up', job: null }))).toEqual({
      kind: 'not_tracked'
    })
  })

  it('a succeeded job with no unresolved flags falls through to the sidecar status', () => {
    const status = batchRowStatus(
      makeItem({ status: 'reviewed', job: makeJob({ state: 'succeeded' }) })
    )
    expect(status).toEqual({ kind: 'reviewed' })
  })
})

describe('batchIsRunning', () => {
  it('is true while any item has a non-terminal job', () => {
    expect(batchIsRunning([makeItem({ job: makeJob({ state: 'queued' }) })])).toBe(true)
    expect(batchIsRunning([makeItem({ job: makeJob({ state: 'running' }) })])).toBe(true)
  })

  it('is false once every job is terminal or absent', () => {
    expect(batchIsRunning([makeItem({ job: null })])).toBe(false)
    expect(batchIsRunning([makeItem({ job: makeJob({ state: 'succeeded' }) })])).toBe(false)
    expect(
      batchIsRunning([
        makeItem({ job: makeJob({ state: 'succeeded' }) }),
        makeItem({ job: makeJob({ state: 'failed' }) })
      ])
    ).toBe(false)
  })

  it('is false for an empty batch', () => {
    expect(batchIsRunning([])).toBe(false)
  })
})

describe('batchProgress', () => {
  it('counts succeeded jobs as done and sums running progress', () => {
    const progress = batchProgress([
      makeJob({ id: 'a', state: 'succeeded', frames_done: 100, frames_total: 100 }),
      makeJob({ id: 'b', state: 'running', frames_done: 50, frames_total: 100, fps: 40 }),
      makeJob({ id: 'c', state: 'queued', frames_done: 0, frames_total: 200, fps: null }),
      makeJob({ id: 'd', state: 'running', frames_done: 10, frames_total: 100, fps: 60 })
    ])
    expect(progress.fraction).toBeCloseTo(160 / 500)
    expect(progress.remainingFrames).toBe(340)
    expect(progress.fps).toBe(100)
  })

  it('excludes failed and cancelled jobs from both sums', () => {
    const progress = batchProgress([
      makeJob({ id: 'a', state: 'succeeded', frames_done: 100, frames_total: 100 }),
      makeJob({ id: 'b', state: 'failed', frames_done: 20, frames_total: 100 }),
      makeJob({ id: 'c', state: 'cancelled', frames_done: 0, frames_total: 100, fps: null })
    ])
    expect(progress.fraction).toBe(1)
    expect(progress.remainingFrames).toBe(0)
  })

  it('is zero for an empty batch', () => {
    expect(batchProgress([])).toEqual({ fraction: 0, remainingFrames: 0, fps: 0 })
  })
})

describe('smoothThroughput', () => {
  it('starts at the first sample and then moves a fraction toward each new one', () => {
    expect(smoothThroughput(null, 100)).toBe(100)
    expect(smoothThroughput(100, 200)).toBeCloseTo(120)
  })
})

describe('batchRemainingSeconds', () => {
  it('divides remaining frames by throughput', () => {
    expect(batchRemainingSeconds(500, 100)).toBe(5)
  })

  it('is null (estimating) without a throughput yet', () => {
    expect(batchRemainingSeconds(500, null)).toBeNull()
    expect(batchRemainingSeconds(500, 0)).toBeNull()
  })

  it('is zero when nothing remains', () => {
    expect(batchRemainingSeconds(0, null)).toBe(0)
  })
})
