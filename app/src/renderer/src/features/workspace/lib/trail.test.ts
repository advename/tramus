import { describe, expect, it } from 'vitest'

import { buildHeatmapPoints, buildTrailSegments, trailFrameWindow } from './trail'
import type { TrackData } from '../data/trackData'
import { FRAME_STATUS_CODES } from '../data/trackData'

/** A track with one detected frame per 0.1 s, plus a 0.4 s "missing" gap in the middle. */
function makeTrack(): TrackData {
  const n = 30
  const t = new Float64Array(n)
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  const status = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    t[i] = i * 0.1
    x[i] = i
    y[i] = i * 2
    const missing = i >= 10 && i < 14
    status[i] = missing ? FRAME_STATUS_CODES.missing : FRAME_STATUS_CODES.detected
    if (missing) {
      x[i] = Number.NaN
      y[i] = Number.NaN
    }
  }
  return {
    frameCount: n,
    t,
    x,
    y,
    semiMajor: new Float32Array(n),
    semiMinor: new Float32Array(n),
    angleDeg: new Float32Array(n),
    status
  }
}

describe('trailFrameWindow', () => {
  it('only includes visible frames within the trailing window', () => {
    const track = makeTrack()
    // currentFrame 20 → 2.0s; a 1.0s window covers frames with t in (1.0, 2.0] → indices 11..20,
    // minus the missing frames 11-13.
    const frames = trailFrameWindow(track, 20, 1.0)
    expect(frames).not.toContain(11)
    expect(frames).not.toContain(13)
    expect(frames[frames.length - 1]).toBe(20)
    expect(frames[0]).toBeGreaterThanOrEqual(10)
  })

  it('returns an empty window before any frames exist', () => {
    const track = makeTrack()
    expect(trailFrameWindow(track, -1, 1)).toEqual([])
  })

  it('is bounded by frame 0 even for a long window', () => {
    const track = makeTrack()
    const frames = trailFrameWindow(track, 5, 100)
    expect(frames[0]).toBe(0)
    expect(frames[frames.length - 1]).toBe(5)
  })
})

describe('buildTrailSegments', () => {
  it('produces one fewer segment than visible frames, ramping opacity up to 1', () => {
    const track = makeTrack()
    const segments = buildTrailSegments(track, 9, 1.0)
    const frames = trailFrameWindow(track, 9, 1.0)
    expect(segments).toHaveLength(frames.length - 1)
    expect(segments[0]!.opacity).toBeLessThan(segments[segments.length - 1]!.opacity)
    expect(segments[segments.length - 1]!.opacity).toBeCloseTo(1)
  })

  it('connects frame coordinates in order', () => {
    const track = makeTrack()
    const segments = buildTrailSegments(track, 3, 1.0)
    expect(segments[0]).toMatchObject({ x1: 0, y1: 0, x2: 1, y2: 2 })
  })
})

describe('buildHeatmapPoints', () => {
  it('subsamples the window by stride', () => {
    const track = makeTrack()
    const points = buildHeatmapPoints(track, 9, 1.0, 2)
    const frames = trailFrameWindow(track, 9, 1.0)
    expect(points.length).toBe(Math.ceil(frames.length / 2))
  })
})
