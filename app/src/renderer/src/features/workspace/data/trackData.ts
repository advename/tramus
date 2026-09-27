import type { FrameStatus, Track } from '../../../api/types'

/** Frame statuses as small integers so a whole track fits in typed arrays. */
export const FRAME_STATUS_CODES = {
  detected: 0,
  interpolated: 1,
  missing: 2,
  manual: 3,
  hidden: 4
} as const satisfies Record<FrameStatus, number>

export type FrameStatusCode = (typeof FRAME_STATUS_CODES)[FrameStatus]

/**
 * The effective track (raw tracking + corrections) in a render-friendly form: one typed array per
 * column, `NaN` where the mouse isn't visible. Index = frame index.
 */
export interface TrackData {
  frameCount: number
  t: Float64Array
  x: Float32Array
  y: Float32Array
  semiMajor: Float32Array
  semiMinor: Float32Array
  angleDeg: Float32Array
  status: Uint8Array
}

export function toTrackData(track: Track): TrackData {
  const n = track.t.length
  const column = (values: (number | null)[]): Float32Array => {
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) out[i] = values[i] ?? Number.NaN
    return out
  }
  const status = new Uint8Array(n)
  for (let i = 0; i < n; i++) status[i] = FRAME_STATUS_CODES[track.status[i]!]
  return {
    frameCount: n,
    t: Float64Array.from(track.t),
    x: column(track.x),
    y: column(track.y),
    semiMajor: column(track.semi_major),
    semiMinor: column(track.semi_minor),
    angleDeg: column(track.angle_deg),
    status
  }
}

/** True when the body position is known at `frame` (detected, interpolated or set by hand). */
export function isVisible(track: TrackData, frame: number): boolean {
  const code = track.status[frame]
  return (
    code === FRAME_STATUS_CODES.detected ||
    code === FRAME_STATUS_CODES.interpolated ||
    code === FRAME_STATUS_CODES.manual
  )
}
