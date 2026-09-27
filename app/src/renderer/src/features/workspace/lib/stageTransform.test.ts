import { describe, expect, it } from 'vitest'

import {
  clampPan,
  computeStageTransform,
  computeViewBox,
  fitScale,
  screenToVideo,
  videoToScreen,
  zoomAroundPoint
} from './stageTransform'

const video = { width: 1600, height: 1200 }

describe('fitScale', () => {
  it('contains the video within the container, picking the tighter axis', () => {
    // Video is 4:3, container is wider — height is the limiting axis.
    expect(fitScale({ width: 1000, height: 300 }, video)).toBeCloseTo(300 / 1200)
  })
})

describe('computeStageTransform / videoToScreen / screenToVideo', () => {
  it('round-trips a point through the transform', () => {
    const args = { container: { width: 800, height: 600 }, video, zoom: 2.5, pan: { x: 30, y: -10 } }
    const t = computeStageTransform(args)
    const screen = videoToScreen(t, { x: 400, y: 300 })
    const back = screenToVideo(t, screen)
    expect(back.x).toBeCloseTo(400)
    expect(back.y).toBeCloseTo(300)
  })

  it('centres the video when zoom = 1 and pan is zero', () => {
    const args = { container: { width: 1600, height: 1200 }, video, zoom: 1, pan: { x: 0, y: 0 } }
    const t = computeStageTransform(args)
    const topLeft = videoToScreen(t, { x: 0, y: 0 })
    expect(topLeft.x).toBeCloseTo(0)
    expect(topLeft.y).toBeCloseTo(0)
  })
})

describe('computeViewBox', () => {
  it('produces a viewBox whose size matches the container at scale 1', () => {
    const container = { width: 1600, height: 1200 }
    const t = computeStageTransform({ container, video, zoom: 1, pan: { x: 0, y: 0 } })
    const [, , w, h] = computeViewBox(t, container).split(' ').map(Number)
    expect(w).toBeCloseTo(video.width)
    expect(h).toBeCloseTo(video.height)
  })
})

describe('zoomAroundPoint', () => {
  it('keeps the video point under the anchor fixed after zooming', () => {
    const container = { width: 800, height: 600 }
    const zoom = 1
    const pan = { x: 0, y: 0 }
    const anchor = { x: 500, y: 200 }
    const before = computeStageTransform({ container, video, zoom, pan })
    const videoPointBefore = screenToVideo(before, anchor)

    const nextPan = zoomAroundPoint({ container, video, zoom, pan, nextZoom: 3, anchor })
    const after = computeStageTransform({ container, video, zoom: 3, pan: nextPan })
    const videoPointAfter = screenToVideo(after, anchor)

    expect(videoPointAfter.x).toBeCloseTo(videoPointBefore.x)
    expect(videoPointAfter.y).toBeCloseTo(videoPointBefore.y)
  })
})

describe('clampPan', () => {
  it('leaves pan alone when the video is smaller than the container (fit)', () => {
    const args = { container: { width: 2000, height: 2000 }, video, zoom: 1, pan: { x: 500, y: 500 } }
    const clamped = clampPan(args.pan, args)
    expect(clamped.x).toBeLessThan(500)
  })

  it('is a no-op for pan within bounds', () => {
    const args = { container: { width: 800, height: 600 }, video, zoom: 4, pan: { x: 10, y: 10 } }
    expect(clampPan(args.pan, args)).toEqual({ x: 10, y: 10 })
  })
})
