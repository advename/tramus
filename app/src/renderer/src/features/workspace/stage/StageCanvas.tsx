import { useEffect, useRef } from 'react'

import type { Size, StageTransform } from '../lib/stageTransform'

export interface StageCanvasProps {
  container: Size
  video: Size
  transform: StageTransform
  /** The frame (or, in tracker view, the detection-preview mask) to draw, stretched to fill `video`. */
  bitmap: ImageBitmap | null
  /** CSS filter string (brightness/contrast, or the tracker view's grayscale/contrast boost). */
  filter: string
}

/**
 * Draws the current frame bitmap onto a devicePixelRatio-aware `<canvas>`, under the same
 * video→screen transform the SVG overlay uses (see `lib/stageTransform.ts`). Frames come from the
 * engine as JPEG — this is why a `<canvas>` is used instead of a `<video>` element (see
 * `docs/architecture.md` §10).
 */
export function StageCanvas({
  container,
  video,
  transform,
  bitmap,
  filter
}: StageCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || container.width === 0 || container.height === 0) return
    const dpr = window.devicePixelRatio || 1
    const pixelWidth = Math.round(container.width * dpr)
    const pixelHeight = Math.round(container.height * dpr)
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!bitmap || video.width === 0 || video.height === 0) return

    ctx.setTransform(
      dpr * transform.scale,
      0,
      0,
      dpr * transform.scale,
      dpr * transform.offsetX,
      dpr * transform.offsetY
    )
    ctx.imageSmoothingEnabled = true
    // The 5-arg drawImage overload stretches the bitmap's own pixel size (which may be a
    // downscaled JPEG, or a mask at the tracker's processing scale) to fill the full-resolution
    // video rect — exactly what both the frame and the tracker mask need.
    ctx.drawImage(bitmap, 0, 0, video.width, video.height)
  }, [bitmap, container.width, container.height, transform, video.width, video.height])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        filter
      }}
    />
  )
}
