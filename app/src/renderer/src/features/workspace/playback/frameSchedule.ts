/**
 * Pure scheduling maths for the playback frame pipeline (`usePlaybackFrames.ts`): which source
 * frames to prefetch next, and which cached frame to display right now. No I/O, no bitmaps — see
 * `frameSchedule.test.ts`.
 */

/**
 * How many source frames apart two *requested* frames should be while playing, so the request
 * rate stays near (but doesn't exceed) `targetFetchFps` regardless of playback speed. At 1×,
 * `sourceFps × speed` is usually already below `targetFetchFps`, so this returns 1 (request
 * every source frame — no reason to skip any). At higher speeds, `sourceFps × speed` source
 * frames need to pass per real second, so every `stride`-th one is requested to stay within
 * `targetFetchFps` requests/s.
 */
export function computeStride(sourceFps: number, speed: number, targetFetchFps: number): number {
  if (sourceFps <= 0 || speed <= 0 || targetFetchFps <= 0) return 1
  return Math.max(1, Math.ceil((sourceFps * speed) / targetFetchFps))
}

/**
 * The frame indices to have in flight or cached, starting at `from` and stepping by `stride`,
 * clamped to `[0, frameCount)`. `count` is how many predicted frames ahead to keep warm (in
 * flight + cached combined).
 */
/**
 * First frame to prefetch: the next multiple of `stride` after `currentFrame`. Keeping predictions
 * on a fixed grid means the wanted set stays stable as the clock advances by uneven amounts, so
 * frames already fetched (or in flight) keep being used instead of shifting by one every tick.
 */
export function nextGridFrame(currentFrame: number, stride: number): number {
  return Math.floor(currentFrame / stride) * stride + stride
}

/** How many grid frames cover `seconds` of playback ahead of the clock (at least `minimum`). */
export function lookaheadCount(
  seconds: number,
  sourceFps: number,
  speed: number,
  stride: number,
  minimum: number
): number {
  return Math.max(minimum, Math.ceil((seconds * sourceFps * speed) / stride))
}

export function predictFrames(
  from: number,
  stride: number,
  count: number,
  frameCount: number
): number[] {
  const frames: number[] = []
  for (let i = 0; i < count; i++) {
    const frame = from + i * stride
    if (frame < 0 || frame >= frameCount) break
    frames.push(frame)
  }
  return frames
}

/**
 * Which cached frame to draw right now. Prefers the newest cached frame at or before
 * `currentFrame` (the clock never shows a frame ahead of itself). If nothing at or before the
 * clock has decoded yet (still warming up, e.g. just after a seek), keeps showing whatever was
 * displayed last rather than flashing blank; if nothing has ever been shown, falls back to the
 * earliest cached frame so something appears while the pipeline catches up.
 */
export function pickDisplayFrame(
  cachedFrames: readonly number[],
  currentFrame: number,
  previousFrame: number | null
): number | null {
  let best: number | null = null
  for (const frame of cachedFrames) {
    if (frame <= currentFrame && (best === null || frame > best)) best = frame
  }
  if (best !== null) return best
  if (previousFrame !== null && cachedFrames.includes(previousFrame)) return previousFrame
  return cachedFrames.length > 0 ? Math.min(...cachedFrames) : null
}
