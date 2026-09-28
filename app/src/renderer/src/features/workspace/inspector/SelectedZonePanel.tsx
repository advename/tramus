import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import type { EllipseShape, RectShape, Shape, Zone } from '../../../api/types'
import { zoneTokens } from '../../../theme/tokens'
import { useSetupEditor } from '../data'
import { shapeBBox } from '../lib/geometry'
import { shapeKindLabel } from '../lib/shapes'
import { mmPerPxOf, pxToUnit, roundForUnit, unitToPx, type ZoneUnit } from '../lib/units'
import { useWorkspaceStore } from '../state/workspaceStore'

export interface SelectedZonePanelProps {
  zone: Zone
  onColorChange: (colorIndex: number) => void
}

/** One editable geometry field: reads/writes the shape's underlying video-px value. */
interface GeometryFieldSpec {
  key: string
  pxValue: number
  apply: (shape: Shape, px: number) => Shape
}

function rectFields(shape: RectShape): GeometryFieldSpec[] {
  return [
    { key: 'X', pxValue: shape.x, apply: (s, px) => ({ ...(s as RectShape), x: px }) },
    { key: 'Y', pxValue: shape.y, apply: (s, px) => ({ ...(s as RectShape), y: px }) },
    {
      key: 'W',
      pxValue: shape.width,
      apply: (s, px) => ({ ...(s as RectShape), width: Math.max(1, px) })
    },
    {
      key: 'H',
      pxValue: shape.height,
      apply: (s, px) => ({ ...(s as RectShape), height: Math.max(1, px) })
    }
  ]
}

function ellipseFields(shape: EllipseShape): GeometryFieldSpec[] {
  return [
    { key: 'X', pxValue: shape.cx, apply: (s, px) => ({ ...(s as EllipseShape), cx: px }) },
    { key: 'Y', pxValue: shape.cy, apply: (s, px) => ({ ...(s as EllipseShape), cy: px }) },
    {
      key: 'W',
      pxValue: shape.rx * 2,
      apply: (s, px) => ({ ...(s as EllipseShape), rx: Math.max(0.5, px / 2) })
    },
    {
      key: 'H',
      pxValue: shape.ry * 2,
      apply: (s, px) => ({ ...(s as EllipseShape), ry: Math.max(0.5, px / 2) })
    }
  ]
}

/**
 * Colour swatches + the selected zone's geometry — editable for rect/ellipse (video px or cm,
 * once a scale is set), read-only bounding box for polygons (design: `hasSel` block).
 *
 * Self-contained: reads `videoId` from the workspace store and edits through its own
 * `useSetupEditor`, so it needs no editor/setup props from its parent (`ZonesList`).
 */
export function SelectedZonePanel({
  zone,
  onColorChange
}: SelectedZonePanelProps): React.JSX.Element {
  const theme = useTheme()
  const videoId = useWorkspaceStore((s) => s.videoId)
  const editor = useSetupEditor(videoId ?? '')
  const setup = editor.setup
  const mmPerPx = mmPerPxOf(setup?.calibration)

  const [storedUnit, setUnit] = useState<ZoneUnit>(mmPerPx != null ? 'cm' : 'px')
  // Falls back to px if calibration is removed while 'cm' was selected — a derived value, not
  // synced state, so removing the scale can't leave a stale 'cm' selection with nothing to convert.
  const unit: ZoneUnit = mmPerPx == null ? 'px' : storedUnit

  const shape = zone.shape
  const fields =
    shape.kind === 'rect' ? rectFields(shape) : shape.kind === 'ellipse' ? ellipseFields(shape) : []

  const commitField = (field: GeometryFieldSpec, displayValue: number, label: string): void => {
    if (!setup) return
    const px = unitToPx(displayValue, unit, mmPerPx)
    const nextShape = field.apply(shape, px)
    const zones = setup.zones ?? []
    void editor.commit(
      { ...setup, zones: zones.map((z) => (z.id === zone.id ? { ...z, shape: nextShape } : z)) },
      label
    )
  }

  const bbox = shape.kind === 'polygon' ? shapeBBox(shape) : null

  return (
    <Box
      sx={{
        mx: 1.75,
        my: 1,
        p: 1.5,
        borderRadius: '8px',
        bgcolor: 'surface.raised',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {shapeKindLabel(zone.shape.kind)} zone
        </Typography>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {zone.name}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>Colour</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {theme.palette.zones.map((color, index) => (
            <ButtonBase
              key={index}
              title={zoneTokens[index]?.name}
              onClick={() => onColorChange(index)}
              sx={{
                width: 22,
                height: 22,
                boxSizing: 'border-box',
                borderRadius: '5px',
                border: '2px solid',
                borderColor: zone.color_index === index ? 'text.primary' : 'transparent',
                bgcolor: color
              }}
            />
          ))}
        </Box>
      </Box>

      {fields.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
              Position and size
            </Typography>
            <UnitToggle unit={unit} onChange={setUnit} disabledCm={mmPerPx == null} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 0.75 }}>
            {fields.map((field) => (
              <GeometryFieldInput
                key={field.key}
                label={field.key}
                displayValue={roundForUnit(pxToUnit(field.pxValue, unit, mmPerPx), unit)}
                onCommit={(value) => commitField(field, value, `Resize zone “${zone.name}”`)}
              />
            ))}
          </Box>
        </Box>
      ) : bbox ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>Bounding box</Typography>
            <UnitToggle unit={unit} onChange={setUnit} disabledCm={mmPerPx == null} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 0.75 }}>
            {[
              { key: 'X', px: bbox.x1 },
              { key: 'Y', px: bbox.y1 },
              { key: 'W', px: bbox.x2 - bbox.x1 },
              { key: 'H', px: bbox.y2 - bbox.y1 }
            ].map((field) => (
              <ReadOnlyGeometryField
                key={field.key}
                label={field.key}
                value={roundForUnit(pxToUnit(field.px, unit, mmPerPx), unit)}
              />
            ))}
          </Box>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {zone.shape.kind === 'polygon' ? zone.shape.points.length : 0} corners. Drag a corner to
            move it; double-click an edge to add one.
          </Typography>
        </Box>
      ) : null}
    </Box>
  )
}

function UnitToggle({
  unit,
  onChange,
  disabledCm
}: {
  unit: ZoneUnit
  onChange: (unit: ZoneUnit) => void
  disabledCm: boolean
}): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: '6px',
        overflow: 'hidden'
      }}
    >
      {(['px', 'cm'] as const).map((u) => (
        <ButtonBase
          key={u}
          disabled={u === 'cm' && disabledCm}
          onClick={() => onChange(u)}
          sx={{
            width: 28,
            height: 20,
            fontSize: 10.5,
            fontWeight: 500,
            bgcolor: unit === u ? 'surface.hover' : 'transparent',
            color: unit === u ? 'text.primary' : 'text.disabled'
          }}
        >
          {u}
        </ButtonBase>
      ))}
    </Box>
  )
}

function GeometryFieldInput({
  label,
  displayValue,
  onCommit
}: {
  label: string
  displayValue: number
  onCommit: (value: number) => void
}): React.JSX.Element {
  // Uncontrolled, keyed by the external value: see `ZoneRow.tsx`'s `commitName` for the same
  // pattern — typing never fights a re-render, and the field resyncs once it loses focus.
  const commit = (raw: string): void => {
    const value = Number(raw)
    if (Number.isFinite(value)) onCommit(value)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        height: 28,
        px: 0.75,
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: '6px',
        bgcolor: 'background.paper',
        minWidth: 0
      }}
    >
      <Typography variant="mono" sx={{ fontSize: 11.5, color: 'text.disabled', flexShrink: 0 }}>
        {label}
      </Typography>
      <InputBase
        key={displayValue}
        type="number"
        defaultValue={displayValue}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.currentTarget.value = String(displayValue)
            e.currentTarget.blur()
          }
        }}
        sx={{ minWidth: 0, fontSize: 11.5, fontFamily: 'inherit', '& input': { p: 0 } }}
      />
    </Box>
  )
}

function ReadOnlyGeometryField({
  label,
  value
}: {
  label: string
  value: number
}): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        height: 28,
        px: 0.75,
        border: 1,
        borderColor: 'surface.lineStrong',
        borderRadius: '6px',
        bgcolor: 'background.paper',
        minWidth: 0
      }}
    >
      <Typography variant="mono" sx={{ fontSize: 11.5, color: 'text.disabled' }}>
        {label}
      </Typography>
      <Typography variant="mono" sx={{ fontSize: 11.5, overflow: 'hidden' }}>
        {value}
      </Typography>
    </Box>
  )
}
