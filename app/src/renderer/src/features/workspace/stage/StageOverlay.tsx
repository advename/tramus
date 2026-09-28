import type { RefObject } from 'react'
import { alpha, type Theme, useTheme } from '@mui/material/styles'

import type { Calibration, Observation, Setup, Zone } from '../../../api/types'
import { bboxHandles, distance, shapeBBox, shapePathD, type Point } from '../lib/geometry'
import type { TrailPoint, TrailSegment } from '../lib/trail'
import type { StageSelection } from '../state/workspaceStore'
import type { CalibrationEndpoint, MeasureDraft, ZoneDraft, ZoneEditingApi } from './useZoneEditing'

export interface BodyEllipse {
  x: number
  y: number
  semiMajor: number
  semiMinor: number
  angleDeg: number
}

export interface PositionMarker {
  x: number
  y: number
  label: string
}

export interface StageOverlayProps {
  svgRef: RefObject<SVGSVGElement | null>
  viewBox: string
  cursor: string
  video: { width: number; height: number }
  setup: Setup | undefined
  selection: StageSelection
  editing: ZoneEditingApi
  /** Show selection handles / vertices (Setup, or Review with the Zones tab open). */
  showHandles: boolean
  stageView: 'video' | 'tracker'
  tracked: boolean
  overlays: { trail: boolean; heatmap: boolean; outline: boolean; currentZone: boolean }
  activeZoneIds: ReadonlySet<string>
  trailSegments: readonly TrailSegment[]
  heatmapPoints: readonly TrailPoint[]
  bodyEllipse: BodyEllipse | null
  positionMarker: PositionMarker | null
  detectionObservation: Observation | null
  detectionBlobAreaLabel: string | null
  /** The scale reference line (Setup only) — `null` if not calibrated or outside Setup. */
  calibration: Calibration | null
  /** A Measure line being drawn, live (drag in progress, or waiting for the second click). */
  measureDraft: MeasureDraft | null
  /** One screen pixel in video pixels (1 / stage scale): keeps handles and labels a constant on-screen size. */
  px: number
  onBackgroundPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void
  onCalibrationHandlePointerDown: (e: React.PointerEvent, endpoint: CalibrationEndpoint) => void
}

const HEAT_GRADIENT_ID = 'tramus-heat-gradient'

/**
 * The video stage's SVG overlay: arena, zones (fill/outline/labels/handles), the trail/heatmap/
 * body-outline/current-zone review layers, the tracker-view detection ellipse, and the shape being
 * drawn. Sits over `StageCanvas` under the same `viewBox` transform (`lib/stageTransform.ts`), so
 * every coordinate here is a video px — `vector-effect="non-scaling-stroke"` keeps strokes and
 * handles a constant screen size regardless of zoom.
 */
export function StageOverlay({
  svgRef,
  viewBox,
  cursor,
  video,
  setup,
  selection,
  editing,
  showHandles,
  stageView,
  tracked,
  overlays,
  activeZoneIds,
  trailSegments,
  heatmapPoints,
  bodyEllipse,
  positionMarker,
  detectionObservation,
  detectionBlobAreaLabel,
  calibration,
  measureDraft,
  px,
  onBackgroundPointerDown,
  onCalibrationHandlePointerDown
}: StageOverlayProps): React.JSX.Element {
  const theme = useTheme()
  const zones = setup?.zones ?? []
  const arena = setup?.arena
  const isTracker = stageView === 'tracker'
  const { draft } = editing

  const labelBg = (highlighted: boolean, color: string): string =>
    highlighted ? color : alpha(theme.palette.background.paper, 0.86)

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      preserveAspectRatio="none"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={editing.onBackgroundPointerMove}
      onDoubleClick={editing.onBackgroundDoubleClick}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        cursor,
        touchAction: 'none'
      }}
    >
      <defs>
        <radialGradient id={HEAT_GRADIENT_ID}>
          <stop offset="0" stopColor={theme.palette.trail} stopOpacity={0.5} />
          <stop offset="1" stopColor={theme.palette.trail} stopOpacity={0} />
        </radialGradient>
      </defs>

      {arena && !isTracker && (
        <path
          d={`M0 0H${video.width}V${video.height}H0Z ${shapePathD(arena)}`}
          fillRule="evenodd"
          fill={theme.palette.surface.dim}
          pointerEvents="none"
        />
      )}

      {arena && (
        <path
          d={shapePathD(arena)}
          fill="none"
          stroke={theme.palette.text.primary}
          strokeWidth={1.25}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}

      {zones
        .filter((z) => z.visible)
        .map((zone) => {
          const selected = selection?.type === 'zone' && selection.zoneId === zone.id
          const highlighted = tracked && overlays.currentZone && activeZoneIds.has(zone.id)
          const color = theme.palette.zones[zone.color_index % theme.palette.zones.length]!
          const fillOpacity = highlighted ? 0.3 : selected ? 0.2 : 0.12
          const b = shapeBBox(zone.shape)
          const labelPos: Point =
            zone.shape.kind === 'polygon'
              ? { x: b.x2 + 6 * px, y: (b.y1 + b.y2) / 2 }
              : { x: b.x1 + 8 * px, y: b.y1 + 8 * px }
          const label = highlighted ? `${zone.name} · mouse here` : zone.name

          return (
            <g key={zone.id}>
              <path
                d={shapePathD(zone.shape)}
                fill={isTracker ? 'none' : alpha(color, fillOpacity)}
                stroke={color}
                strokeWidth={selected || highlighted ? 2.5 : 1.5}
                strokeDasharray={isTracker ? '5 4' : undefined}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: editing.activeTool === 'select' ? 'pointer' : undefined }}
                onPointerDown={(e) => editing.onZonePointerDown(e, zone)}
              />
              {!isTracker && (
                <ZoneLabel
                  x={labelPos.x}
                  y={labelPos.y}
                  text={label}
                  swatch={highlighted ? theme.palette.getContrastText(color) : color}
                  bg={labelBg(highlighted, color)}
                  fg={
                    highlighted ? theme.palette.getContrastText(color) : theme.palette.text.primary
                  }
                  stroke={color}
                  px={px}
                />
              )}
              {showHandles && selected && !zone.locked && (
                <ZoneHandles zone={zone} color={color} editing={editing} px={px} />
              )}
            </g>
          )
        })}

      {overlays.heatmap && tracked && !isTracker && (
        <>
          {heatmapPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={30}
              fill={`url(#${HEAT_GRADIENT_ID})`}
              opacity={p.opacity}
              pointerEvents="none"
            />
          ))}
        </>
      )}

      {overlays.trail && tracked && !isTracker && (
        <>
          {trailSegments.map((s, i) => (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={theme.palette.trail}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={s.opacity}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
        </>
      )}

      {overlays.outline && tracked && !isTracker && bodyEllipse && (
        <>
          <ellipse
            cx={bodyEllipse.x}
            cy={bodyEllipse.y}
            rx={bodyEllipse.semiMajor}
            ry={bodyEllipse.semiMinor}
            transform={`rotate(${bodyEllipse.angleDeg} ${bodyEllipse.x} ${bodyEllipse.y})`}
            fill="none"
            stroke={theme.palette.common.white}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <circle
            cx={bodyEllipse.x}
            cy={bodyEllipse.y}
            r={2.5}
            fill={theme.palette.common.white}
            pointerEvents="none"
          />
        </>
      )}

      {isTracker && detectionObservation && (
        <>
          <ellipse
            cx={detectionObservation.x}
            cy={detectionObservation.y}
            rx={detectionObservation.semi_major}
            ry={detectionObservation.semi_minor}
            transform={`rotate(${detectionObservation.angle_deg} ${detectionObservation.x} ${detectionObservation.y})`}
            fill="none"
            stroke={theme.palette.detection}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {detectionBlobAreaLabel && (
            <text
              x={detectionObservation.x + 42 * px}
              y={detectionObservation.y - 15 * px}
              fill={theme.palette.detection}
              style={{ font: `500 ${11 * px}px "IBM Plex Mono"` }}
            >
              mouse · {detectionBlobAreaLabel}
            </text>
          )}
        </>
      )}

      {calibration && (
        <MeasureLine
          a={{ x: calibration.x1, y: calibration.y1 }}
          b={{ x: calibration.x2, y: calibration.y2 }}
          label={`${calibration.length_mm} mm`}
          color={theme.palette.text.secondary}
          dashed
          px={px}
        />
      )}
      {calibration && editing.activeTool === 'select' && (
        <>
          <MeasureHandle
            x={calibration.x1}
            y={calibration.y1}
            px={px}
            color={theme.palette.text.secondary}
            onPointerDown={(e) => onCalibrationHandlePointerDown(e, 'start')}
          />
          <MeasureHandle
            x={calibration.x2}
            y={calibration.y2}
            px={px}
            color={theme.palette.text.secondary}
            onPointerDown={(e) => onCalibrationHandlePointerDown(e, 'end')}
          />
        </>
      )}
      {measureDraft && (
        <MeasureLine
          a={measureDraft.start}
          b={measureDraft.current}
          label={`${Math.round(distance(measureDraft.start, measureDraft.current))} px`}
          color={theme.palette.primary.main}
          dashed
          px={px}
        />
      )}

      {positionMarker && (
        <>
          <circle
            cx={positionMarker.x}
            cy={positionMarker.y}
            r={11 * px}
            fill="none"
            stroke={theme.palette.warning.main}
            strokeWidth={1.5}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <text
            x={positionMarker.x + 16 * px}
            y={positionMarker.y - 14 * px}
            fill={theme.palette.warning.main}
            style={{ font: `500 ${11 * px}px "IBM Plex Mono"` }}
          >
            {positionMarker.label}
          </text>
        </>
      )}

      <DraftPreview draft={draft} theme={theme} />
    </svg>
  )
}

interface ZoneLabelProps {
  x: number
  y: number
  text: string
  swatch: string
  bg: string
  fg: string
  stroke: string
  px: number
}

function ZoneLabel({ x, y, text, swatch, bg, fg, stroke, px }: ZoneLabelProps): React.JSX.Element {
  const width = Math.round(text.length * 6.1 + 28)
  return (
    <g transform={`translate(${x} ${y}) scale(${px})`} pointerEvents="none">
      <rect
        x={0}
        y={0}
        width={width}
        height={19}
        rx={4}
        fill={bg}
        stroke={stroke}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <rect x={7} y={6.5} width={6} height={6} rx={1.5} fill={swatch} />
      <text x={18} y={13.5} fill={fg} style={{ font: `500 11px "IBM Plex Sans"` }}>
        {text}
      </text>
    </g>
  )
}

function ZoneHandles({
  zone,
  color,
  editing,
  px
}: {
  zone: Zone
  color: string
  editing: ZoneEditingApi
  px: number
}): React.JSX.Element {
  if (zone.shape.kind === 'polygon') {
    return (
      <>
        {zone.shape.points.map((point, i) => (
          <rect
            key={i}
            x={(point[0] ?? 0) - 4 * px}
            y={(point[1] ?? 0) - 4 * px}
            width={8 * px}
            height={8 * px}
            rx={1.5 * px}
            fill="white"
            stroke={color}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'move' }}
            onPointerDown={(e) => editing.onVertexPointerDown(e, zone, i)}
          />
        ))}
      </>
    )
  }
  const handles = bboxHandles(shapeBBox(zone.shape))
  return (
    <>
      {handles.map((h, i) => (
        <rect
          key={i}
          x={h.x - 4 * px}
          y={h.y - 4 * px}
          width={8 * px}
          height={8 * px}
          rx={1.5 * px}
          fill="white"
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: h.cursor }}
          onPointerDown={(e) => editing.onHandlePointerDown(e, zone, i)}
        />
      ))}
    </>
  )
}

interface MeasureLineProps {
  a: Point
  b: Point
  label: string
  color: string
  dashed?: boolean
  px: number
}

/** A calibration line: the segment, a perpendicular tick at each end, and a length label. */
function MeasureLine({ a, b, label, color, dashed, px }: MeasureLineProps): React.JSX.Element {
  const len = distance(a, b) || 1
  // Unit vector perpendicular to a→b, for the end ticks.
  const ux = (-(b.y - a.y) / len) * 8 * px
  const uy = ((b.x - a.x) / len) * 8 * px
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2

  return (
    <g pointerEvents="none">
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '5 4' : undefined}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={a.x - ux}
        y1={a.y - uy}
        x2={a.x + ux}
        y2={a.y + uy}
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={b.x - ux}
        y1={b.y - uy}
        x2={b.x + ux}
        y2={b.y + uy}
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={midX}
        y={midY - 8 * px}
        textAnchor="middle"
        fill={color}
        style={{ font: `500 ${11 * px}px "IBM Plex Mono"` }}
      >
        {label}
      </text>
    </g>
  )
}

function MeasureHandle({
  x,
  y,
  px,
  color,
  onPointerDown
}: {
  x: number
  y: number
  px: number
  color: string
  onPointerDown: (e: React.PointerEvent) => void
}): React.JSX.Element {
  return (
    <circle
      cx={x}
      cy={y}
      r={5 * px}
      fill="white"
      stroke={color}
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      style={{ cursor: 'move' }}
      onPointerDown={onPointerDown}
    />
  )
}

function DraftPreview({
  draft,
  theme
}: {
  draft: ZoneDraft | null
  theme: Theme
}): React.JSX.Element | null {
  if (!draft) return null
  const stroke = theme.palette.primary.main
  if (draft.kind === 'polygon') {
    const pts = draft.cursor ? [...draft.points, draft.cursor] : draft.points
    if (pts.length === 0) return null
    const d =
      `M${pts[0]!.x} ${pts[0]!.y}` +
      pts
        .slice(1)
        .map((p) => `L${p.x} ${p.y}`)
        .join('')
    return (
      <g pointerEvents="none">
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        {draft.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={stroke} />
        ))}
      </g>
    )
  }
  const x1 = Math.min(draft.start.x, draft.current.x)
  const y1 = Math.min(draft.start.y, draft.current.y)
  const w = Math.abs(draft.start.x - draft.current.x)
  const h = Math.abs(draft.start.y - draft.current.y)
  return (
    <g pointerEvents="none">
      {draft.kind === 'rect' ? (
        <rect
          x={x1}
          y={y1}
          width={w}
          height={h}
          fill={alpha(stroke, 0.12)}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <ellipse
          cx={(draft.start.x + draft.current.x) / 2}
          cy={(draft.start.y + draft.current.y) / 2}
          rx={w / 2}
          ry={h / 2}
          fill={alpha(stroke, 0.12)}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}
