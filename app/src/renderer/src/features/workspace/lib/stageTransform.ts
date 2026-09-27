import type { Point } from './geometry'

/**
 * The video (px) ↔ screen (stage-container px) mapping. The canvas frame and the SVG overlay
 * share exactly this transform — the canvas applies it via `CanvasRenderingContext2D.setTransform`
 * (see `stage/StageCanvas.tsx`), the SVG applies it via its `viewBox` (see `computeViewBox`).
 */
export interface StageTransform {
  /** video px → screen px. */
  scale: number
  /** Screen-px position of video point (0, 0). */
  offsetX: number
  offsetY: number
}

export interface Size {
  width: number
  height: number
}

/** The "contain" scale that fits the whole video inside the container (zoom = 1). */
export function fitScale(container: Size, video: Size): number {
  if (video.width <= 0 || video.height <= 0 || container.width <= 0 || container.height <= 0) {
    return 1
  }
  return Math.min(container.width / video.width, container.height / video.height)
}

export interface ComputeTransformArgs {
  container: Size
  video: Size
  /** 1 = fit to the container. */
  zoom: number
  /** Screen-px offset from the centred fit (positive = pan right/down). */
  pan: Point
}

export function computeStageTransform(a: ComputeTransformArgs): StageTransform {
  const scale = fitScale(a.container, a.video) * a.zoom
  const offsetX = (a.container.width - a.video.width * scale) / 2 + a.pan.x
  const offsetY = (a.container.height - a.video.height * scale) / 2 + a.pan.y
  return { scale, offsetX, offsetY }
}

export function videoToScreen(t: StageTransform, p: Point): Point {
  return { x: p.x * t.scale + t.offsetX, y: p.y * t.scale + t.offsetY }
}

export function screenToVideo(t: StageTransform, p: Point): Point {
  return { x: (p.x - t.offsetX) / t.scale, y: (p.y - t.offsetY) / t.scale }
}

/** The SVG `viewBox` string (video-space rect currently visible) matching this transform. */
export function computeViewBox(t: StageTransform, container: Size): string {
  const x = -t.offsetX / t.scale
  const y = -t.offsetY / t.scale
  const w = container.width / t.scale
  const h = container.height / t.scale
  return `${x} ${y} ${w} ${h}`
}

export interface ZoomAroundPointArgs {
  container: Size
  video: Size
  zoom: number
  pan: Point
  nextZoom: number
  /** The screen point that should stay under the same video point after zooming (e.g. the cursor). */
  anchor: Point
}

/** The new `pan` that keeps `anchor` pointing at the same video pixel after zooming to `nextZoom`. */
export function zoomAroundPoint(a: ZoomAroundPointArgs): Point {
  const before = computeStageTransform(a)
  const videoPoint = screenToVideo(before, a.anchor)
  const scale = fitScale(a.container, a.video) * a.nextZoom
  const centeredX = (a.container.width - a.video.width * scale) / 2
  const centeredY = (a.container.height - a.video.height * scale) / 2
  return {
    x: a.anchor.x - videoPoint.x * scale - centeredX,
    y: a.anchor.y - videoPoint.y * scale - centeredY
  }
}

/**
 * Client (pointer event) coordinates → video px, via the overlay SVG's own screen CTM. More
 * robust than inverting `StageTransform` by hand for pointer math, since the browser accounts for
 * the SVG's `viewBox`, its on-page position and any ancestor CSS transforms in one step.
 */
export function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

/** Clamps pan so the video can't be dragged further than `marginPx` past the container edge. */
export function clampPan(pan: Point, a: ComputeTransformArgs, marginPx = 80): Point {
  const scale = fitScale(a.container, a.video) * a.zoom
  const videoW = a.video.width * scale
  const videoH = a.video.height * scale
  const maxPanX = Math.max(marginPx, (videoW - a.container.width) / 2 + marginPx)
  const maxPanY = Math.max(marginPx, (videoH - a.container.height) / 2 + marginPx)
  return {
    x: Math.min(maxPanX, Math.max(-maxPanX, pan.x)),
    y: Math.min(maxPanY, Math.max(-maxPanY, pan.y))
  }
}
