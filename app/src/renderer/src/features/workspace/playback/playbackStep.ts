import { frameAtTime, timeOfFrame, videoDuration } from '../lib/frames'

/** The playback clock's continuous state, carried between ticks. */
export interface PlaybackClockState {
  /** Continuous video time in seconds — not just the current frame's own timestamp. */
  time: number
  /** The frame index `time` last resolved to (i.e. the one the clock itself last requested). */
  frame: number
}

export interface PlaybackStepResult {
  state: PlaybackClockState
  /** The frame to display for this tick. */
  frame: number
  /** True once playback has reached the end of the video (caller should pause). */
  finished: boolean
}

/**
 * One tick of the playback clock. Advances `state.time` by `dt * speed`, *unless* `currentFrame`
 * no longer matches `state.frame` — meaning something else (a seek, a scrub, a frame step) moved
 * playback since the last tick — in which case `state.time` is first re-synced to that frame's
 * own time. This is what makes 1× playback actually advance: unlike recomputing `nextTime` from
 * `timeOfFrame(currentFrame)` every tick (which discards any sub-frame progress a tick that
 * didn't cross a frame boundary made), a continuous clock accumulates `dt` across ticks.
 */
export function stepPlaybackClock(
  state: PlaybackClockState,
  currentFrame: number,
  dt: number,
  speed: number,
  frameTimes: Float64Array
): PlaybackStepResult {
  const baseTime = state.frame === currentFrame ? state.time : timeOfFrame(frameTimes, currentFrame)
  const duration = videoDuration(frameTimes)
  const nextTime = baseTime + dt * speed

  if (nextTime >= duration) {
    const lastFrame = Math.max(0, frameTimes.length - 1)
    const lastTime = timeOfFrame(frameTimes, lastFrame)
    return { state: { time: lastTime, frame: lastFrame }, frame: lastFrame, finished: true }
  }

  const frame = frameAtTime(frameTimes, nextTime)
  return { state: { time: nextTime, frame }, frame, finished: false }
}

/** The clock state to start (or resume) playback from, synced to the frame it's playing from. */
export function initPlaybackClock(
  frameTimes: Float64Array,
  currentFrame: number
): PlaybackClockState {
  return { time: timeOfFrame(frameTimes, currentFrame), frame: currentFrame }
}
