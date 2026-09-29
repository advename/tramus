import { type RefObject, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { Symbol } from '../../../components/Symbol'
import { formatFrameCount } from '../../../lib/time'
import type { Point } from '../lib/geometry'
import { svgPointFromClient } from '../lib/stageTransform'

export interface StatusBarProps {
  svgRef: RefObject<SVGSVGElement | null>
  zoomPercent: number
  frame: number
  frameCount: number
  videoWidth: number
  videoHeight: number
  nominalFps: number
  /** The current frame falls inside a `Setup.exclusion` (§5.5) — shows a small, subtle badge. */
  excluded: boolean
}

/**
 * Tracks the pointer's video-px position locally (via the overlay SVG's own CTM) so mouse moves
 * only re-render this small readout, not the whole stage.
 */
function useCursorVideoPoint(svgRef: RefObject<SVGSVGElement | null>): Point | null {
  const [point, setPoint] = useState<Point | null>(null)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return undefined
    const onMove = (e: PointerEvent): void =>
      setPoint(svgPointFromClient(svg, e.clientX, e.clientY))
    const onLeave = (): void => setPoint(null)
    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerleave', onLeave)
    return () => {
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerleave', onLeave)
    }
  }, [svgRef])
  return point
}

/** The stage's bottom readout: zoom, frame number, cursor px position, resolution/fps. */
export function StatusBar({
  svgRef,
  zoomPercent,
  frame,
  frameCount,
  videoWidth,
  videoHeight,
  nominalFps,
  excluded
}: StatusBarProps): React.JSX.Element {
  const cursorVideoPoint = useCursorVideoPoint(svgRef)
  return (
    <Box
      sx={{
        position: 'absolute',
        left: 60,
        right: 12,
        bottom: 7,
        display: 'flex',
        gap: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      <Typography variant="mono" sx={{ fontSize: 11, color: 'text.disabled' }}>
        {zoomPercent}%
      </Typography>
      <Typography variant="mono" sx={{ fontSize: 11, color: 'text.disabled' }}>
        Frame {formatFrameCount(frame)} / {formatFrameCount(Math.max(0, frameCount - 1))}
      </Typography>
      {cursorVideoPoint && (
        <Typography variant="mono" sx={{ fontSize: 11, color: 'text.disabled' }}>
          x {Math.round(cursorVideoPoint.x)} y {Math.round(cursorVideoPoint.y)} px
        </Typography>
      )}
      {excluded && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Symbol name="block" size={12} sx={{ color: 'text.disabled' }} />
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
            Excluded from analysis
          </Typography>
        </Box>
      )}
      <Box sx={{ flex: 1 }} />
      <Typography variant="mono" sx={{ fontSize: 11, color: 'text.disabled' }}>
        {videoWidth} × {videoHeight} · {nominalFps % 1 === 0 ? nominalFps : nominalFps.toFixed(2)}{' '}
        fps
      </Typography>
    </Box>
  )
}
