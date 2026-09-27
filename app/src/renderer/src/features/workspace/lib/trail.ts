import { isVisible, type TrackData } from '../data'

/**
 * The movement trail / heatmap window: the last `lengthS` seconds of *visible* positions up to
 * `currentFrame`. Built directly from the typed-array track (no per-frame object allocation for
 * the scan) so it's cheap to recompute every playback tick.
 */

export interface TrailSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  /** 0..1 — older segments are fainter. */
  opacity: number
}

export interface TrailPoint {
  x: number
  y: number
  opacity: number
}

/** Visible frame indices within the trailing `lengthS`-second window, oldest first. */
export function trailFrameWindow(
  track: TrackData,
  currentFrame: number,
  lengthS: number
): number[] {
  if (currentFrame < 0 || currentFrame >= track.frameCount) return []
  const frames: number[] = []
  const endTime = track.t[currentFrame] ?? 0
  for (let f = currentFrame; f >= 0; f--) {
    const t = track.t[f]
    if (t === undefined || endTime - t > lengthS) break
    if (isVisible(track, f)) frames.push(f)
  }
  frames.reverse()
  return frames
}

/** Line segments connecting consecutive visible frames in the window, with an opacity ramp. */
export function buildTrailSegments(
  track: TrackData,
  currentFrame: number,
  lengthS: number
): TrailSegment[] {
  const frames = trailFrameWindow(track, currentFrame, lengthS)
  const segments: TrailSegment[] = []
  const n = frames.length - 1
  for (let i = 1; i < frames.length; i++) {
    const f0 = frames[i - 1]!
    const f1 = frames[i]!
    segments.push({
      x1: track.x[f0]!,
      y1: track.y[f0]!,
      x2: track.x[f1]!,
      y2: track.y[f1]!,
      opacity: 0.15 + 0.85 * (i / Math.max(1, n))
    })
  }
  return segments
}

/** A sparser set of points (every `stride`-th visible frame) for a blurred heatmap dot layer. */
export function buildHeatmapPoints(
  track: TrackData,
  currentFrame: number,
  lengthS: number,
  stride = 2
): TrailPoint[] {
  const frames = trailFrameWindow(track, currentFrame, lengthS).filter((_, i) => i % stride === 0)
  const n = Math.max(1, frames.length - 1)
  return frames.map((f, i) => ({
    x: track.x[f]!,
    y: track.y[f]!,
    opacity: 0.35 + 0.65 * (i / n)
  }))
}
