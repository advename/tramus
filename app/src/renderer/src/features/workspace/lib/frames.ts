/**
 * Frame ↔ time conversions based on the video's frame-times array (seconds since the first frame,
 * one entry per frame, strictly increasing). Never use `frame / fps`: recordings are variable
 * frame rate.
 */

/** Time of `frame` in seconds (clamped to the video). */
export function timeOfFrame(frameTimes: Float64Array, frame: number): number {
  if (frameTimes.length === 0) return 0
  const index = Math.min(frameTimes.length - 1, Math.max(0, Math.round(frame)))
  return frameTimes[index]!
}

/** The frame being shown at time `t`: the last frame whose time is ≤ t (binary search). */
export function frameAtTime(frameTimes: Float64Array, t: number): number {
  let low = 0
  let high = frameTimes.length - 1
  if (high < 0 || t <= frameTimes[0]!) return 0
  if (t >= frameTimes[high]!) return high
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (frameTimes[mid]! <= t) low = mid
    else high = mid - 1
  }
  return low
}

/** The frame whose time is closest to `t` — for snapping a dragged handle or a click. */
export function nearestFrame(frameTimes: Float64Array, t: number): number {
  const frame = frameAtTime(frameTimes, t)
  const next = Math.min(frameTimes.length - 1, frame + 1)
  return Math.abs(frameTimes[next]! - t) < Math.abs(t - frameTimes[frame]!) ? next : frame
}

/** Median frame interval in seconds (e.g. to give the last frame a duration). */
export function medianFrameInterval(frameTimes: Float64Array): number {
  if (frameTimes.length < 2) return 0.04
  const deltas = Array.from(frameTimes.subarray(1), (t, i) => t - frameTimes[i]!).sort(
    (a, b) => a - b
  )
  return deltas[deltas.length >> 1]!
}

/** Total length of the video in seconds (end of the last frame). */
export function videoDuration(frameTimes: Float64Array): number {
  if (frameTimes.length === 0) return 0
  return frameTimes[frameTimes.length - 1]! + medianFrameInterval(frameTimes)
}
