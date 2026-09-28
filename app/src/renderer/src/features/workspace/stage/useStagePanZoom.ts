import { useCallback, useEffect, useRef, useState } from 'react'

import type { Point } from '../lib/geometry'
import { clampPan, type Size, zoomAroundPoint } from '../lib/stageTransform'
import { STAGE_ZOOM_MAX, STAGE_ZOOM_MIN, useWorkspaceStore } from '../state/workspaceStore'

function clampZoom(zoom: number): number {
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, zoom))
}

export interface StagePanZoomApi {
  isPanning: boolean
  /** Cursor to show over the stage: pan tool, space-held, or actively panning. */
  cursor: 'grab' | 'grabbing' | undefined
  onWheel: (e: React.WheelEvent<Element>) => void
  /**
   * Starts a pan drag if `e` should pan (pan tool active, space held, or a middle-mouse drag).
   * Returns `true` when it took over the gesture — callers should skip their own handling.
   */
  tryStartPan: (e: React.PointerEvent<Element>) => boolean
  zoomBy: (factor: number, anchor?: Point) => void
  zoomFit: () => void
}

/**
 * Pan (drag) and zoom (1–8×, around the cursor) for the video stage. Space held down or the "pan"
 * tool arms panning on the next drag; middle-mouse always pans. Space is also the play/pause
 * shortcut (registered separately) — holding it to start a pan also toggles playback once, a
 * minor known overlap rather than tracking a full "was this tap or a drag" state machine.
 */
export function useStagePanZoom(container: Size, video: Size): StagePanZoomApi {
  const zoom = useWorkspaceStore((s) => s.stageZoom)
  const pan = useWorkspaceStore((s) => s.stagePan)
  const setStageZoom = useWorkspaceStore((s) => s.setStageZoom)
  const setStagePan = useWorkspaceStore((s) => s.setStagePan)
  const resetStageView = useWorkspaceStore((s) => s.resetStageView)

  const spaceHeldRef = useRef(false)
  const [isPanning, setIsPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      )
        return
      spaceHeldRef.current = true
      setSpaceHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return
      spaceHeldRef.current = false
      setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const applyZoom = useCallback(
    (nextZoomRaw: number, anchor: Point) => {
      const nextZoom = clampZoom(nextZoomRaw)
      const nextPan = zoomAroundPoint({ container, video, zoom, pan, nextZoom, anchor })
      setStageZoom(nextZoom)
      setStagePan(clampPan(nextPan, { container, video, zoom: nextZoom, pan: nextPan }))
    },
    [container, video, zoom, pan, setStageZoom, setStagePan]
  )

  const zoomBy = useCallback(
    (factor: number, anchor?: Point) => {
      const center = anchor ?? { x: container.width / 2, y: container.height / 2 }
      applyZoom(zoom * factor, center)
    },
    [applyZoom, zoom, container.width, container.height]
  )

  const zoomFit = useCallback(() => resetStageView(), [resetStageView])

  const onWheel = useCallback(
    (e: React.WheelEvent<Element>) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      applyZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), anchor)
    },
    [applyZoom, zoom]
  )

  const tryStartPan = useCallback(
    (e: React.PointerEvent<Element>): boolean => {
      const { setupTool, reviewTool } = useWorkspaceStore.getState()
      const toolIsPan = setupTool === 'pan' || reviewTool === 'pan'
      const shouldPan = toolIsPan || spaceHeldRef.current || e.button === 1
      if (!shouldPan) return false
      e.preventDefault()
      e.stopPropagation()
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)
      const start = { x: e.clientX, y: e.clientY }
      const startPan = pan
      setIsPanning(true)
      const onMove = (ev: PointerEvent): void => {
        const next = {
          x: startPan.x + (ev.clientX - start.x),
          y: startPan.y + (ev.clientY - start.y)
        }
        setStagePan(clampPan(next, { container, video, zoom, pan: next }))
      }
      const onUp = (): void => {
        setIsPanning(false)
        target.releasePointerCapture(e.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return true
    },
    [pan, container, video, zoom, setStagePan]
  )

  const toolIsPan = useWorkspaceStore((s) => s.setupTool === 'pan' || s.reviewTool === 'pan')
  const cursor = isPanning ? 'grabbing' : toolIsPan || spaceHeld ? 'grab' : undefined

  return { isPanning, cursor, onWheel, tryStartPan, zoomBy, zoomFit }
}
