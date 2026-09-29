/**
 * Which frame's overlays (trail, heatmap, body outline, current zone, flag banner, position
 * marker, status bar) should be drawn right now — pure selection, no I/O. See `VideoStage.tsx`.
 *
 * The video stage draws whichever bitmap the playback pipeline currently has ready
 * (`usePlaybackFrames`, or `useImageBitmap` for the exact/paused path), which lags the clock's
 * `currentFrame` by design (§10 of the architecture doc). Overlays computed from `currentFrame`
 * used to run visibly ahead of the drawn frame during playback. `selectShownFrame` mirrors the
 * exact same fallback chain the two hooks already use to pick a bitmap, so the frame this
 * function returns always matches the frame the bitmap on screen actually is:
 *
 * - Playing: the predictive pipeline's frame if it has one yet, else the exact-frame pipeline's
 *   (which runs continuously and stands in during the predictive pipeline's first moment).
 * - Paused/scrubbing: the exact-frame pipeline's frame — it lags `currentFrame` until the newly
 *   requested frame has actually loaded, exactly like the bitmap it fetched.
 * - Nothing has loaded yet either way (e.g. right after opening the video): `currentFrame`, same
 *   fallback the bitmap side uses (nothing to draw regardless).
 */
export function selectShownFrame(
  playing: boolean,
  playingFrame: number | null,
  exactFrame: number | null,
  currentFrame: number
): number {
  if (playing && playingFrame !== null) return playingFrame
  if (exactFrame !== null) return exactFrame
  return currentFrame
}
