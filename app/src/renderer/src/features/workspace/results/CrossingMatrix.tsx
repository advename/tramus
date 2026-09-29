import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { alpha, type Theme, useTheme } from '@mui/material/styles'

import type { CrossingRule, MatrixCell, Zone } from '../../../api/types'
import { Symbol } from '../../../components/Symbol'
import { findRuleForPair, heatIntensity, matrixCount, maxMatrixCount } from '../lib/crossings'

export interface CrossingMatrixProps {
  zones: readonly Zone[]
  matrix: readonly MatrixCell[]
  rules: readonly CrossingRule[]
  selectedRuleId: string | null
  onCellClick: (fromZoneId: string, toZoneId: string) => void
}

const LABEL_COLUMN = 104

/**
 * From (rows) × to (columns) crossing counts for every zone pair, shaded by count (design: the
 * Summary table's card chrome). The diagonal is a re-entry (same zone both sides — §5.7).
 * Clicking a cell adds that pair as a rule, or selects it if one already covers it exactly.
 */
export function CrossingMatrix({
  zones,
  matrix,
  rules,
  selectedRuleId,
  onCellClick
}: CrossingMatrixProps): React.JSX.Element {
  const theme = useTheme()
  const max = maxMatrixCount(matrix)
  const gridTemplateColumns = `${LABEL_COLUMN}px repeat(${zones.length}, minmax(44px, 1fr))`

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          height: 40,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Crossing matrix</Typography>
        <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
          from (rows) → to (columns)
        </Typography>
      </Box>

      <Box sx={{ p: 1.5, overflowX: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns, gap: '3px', minWidth: 'fit-content' }}>
          <Box />
          {zones.map((zone) => (
            <ZoneHeaderCell key={zone.id} zone={zone} theme={theme} />
          ))}

          {zones.map((fromZone) => (
            <Box key={fromZone.id} sx={{ display: 'contents' }}>
              <ZoneHeaderCell zone={fromZone} theme={theme} align="left" />
              {zones.map((toZone) => {
                const count = matrixCount(matrix, fromZone.id, toZone.id)
                const isDiagonal = fromZone.id === toZone.id
                const existingRule = findRuleForPair(rules, fromZone.id, toZone.id)
                const selected = existingRule != null && existingRule.id === selectedRuleId
                const intensity = heatIntensity(count, max)
                return (
                  <ButtonBase
                    key={toZone.id}
                    title={`${fromZone.name} → ${toZone.name}${isDiagonal ? ' (re-entry)' : ''}: ${count}`}
                    onClick={() => onCellClick(fromZone.id, toZone.id)}
                    sx={{
                      height: 34,
                      borderRadius: '5px',
                      position: 'relative',
                      bgcolor: alpha(theme.palette.primary.main, 0.08 + intensity * 0.55),
                      border: '1px solid',
                      borderColor: selected ? 'primary.main' : 'transparent',
                      outline: selected ? `1px solid ${theme.palette.primary.main}` : 'none',
                      outlineOffset: '-2px'
                    }}
                  >
                    <Typography
                      variant="mono"
                      sx={{
                        fontSize: 12.5,
                        fontWeight: count > 0 ? 600 : 400,
                        color: count > 0 ? 'text.primary' : 'text.disabled'
                      }}
                    >
                      {count}
                    </Typography>
                    {isDiagonal ? (
                      <Symbol
                        name="restart_alt"
                        size={11}
                        sx={{ position: 'absolute', top: 2, right: 2, color: 'text.disabled' }}
                      />
                    ) : null}
                  </ButtonBase>
                )
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function ZoneHeaderCell({
  zone,
  theme,
  align = 'center'
}: {
  zone: Zone
  theme: Theme
  align?: 'left' | 'center'
}): React.JSX.Element {
  return (
    <Box
      title={zone.name}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        gap: 0.625,
        px: 0.5,
        minWidth: 0,
        fontSize: 11.5,
        color: 'text.secondary'
      }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '2px',
          bgcolor: theme.palette.zones[zone.color_index % theme.palette.zones.length],
          flexShrink: 0
        }}
      />
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {zone.name}
      </Box>
    </Box>
  )
}
