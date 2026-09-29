import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select, { type SelectChangeEvent } from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import type { CrossingEvent, CrossingResult, CrossingRule, Zone } from '../../../api/types'
import { Symbol } from '../../../components/Symbol'
import { formatClockTime, formatVideoTime } from '../../../lib/time'
import { ANY_ZONE_LABEL, resultForRule, zoneColorIndex, zoneLabel } from '../lib/crossings'

const ANY_ZONE_VALUE = ''

export interface CrossingRulesCardProps {
  zones: readonly Zone[]
  rules: readonly CrossingRule[]
  crossings: readonly CrossingResult[]
  recordedAt: string | null
  selectedRuleId: string | null
  onSelectRule: (ruleId: string | null) => void
  onAddRule: () => void
  onRemoveRule: (ruleId: string) => void
  onChangeRule: (ruleId: string, patch: Partial<CrossingRule>) => void
  onEventClick: (event: CrossingEvent) => void
}

/**
 * The Crossings view's rules table: `[From ▾] → [To ▾]` and a count per `CrossingRule`, with
 * add/remove — selecting a row expands its matching events underneath it (design: the Results
 * Summary table's card chrome, reused here).
 */
export function CrossingRulesCard({
  zones,
  rules,
  crossings,
  recordedAt,
  selectedRuleId,
  onSelectRule,
  onAddRule,
  onRemoveRule,
  onChangeRule,
  onEventClick
}: CrossingRulesCardProps): React.JSX.Element {
  const theme = useTheme()

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
        <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Crossing rules</Typography>
        <ButtonBase
          onClick={onAddRule}
          disabled={zones.length < 2}
          sx={{
            height: 26,
            pl: 0.625,
            pr: 1.125,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            fontSize: 12,
            fontWeight: 500,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'surface.hover', color: 'text.primary' }
          }}
        >
          <Symbol name="add" size={16} />
          Add rule
        </ButtonBase>
      </Box>

      {rules.length === 0 ? (
        <Box sx={{ px: 2, py: 2.5, fontSize: 12.5, color: 'text.disabled' }}>
          No crossing rules yet. Add one to count transitions between zones (e.g. Left → Right).
        </Box>
      ) : (
        rules.map((rule) => {
          const result = resultForRule(crossings, rule.id)
          const selected = rule.id === selectedRuleId
          return (
            <Box key={rule.id}>
              <Box
                onClick={() => onSelectRule(selected ? null : rule.id)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto auto',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: selected ? alpha(theme.palette.primary.main, 0.13) : 'transparent',
                  '&:hover': { bgcolor: selected ? undefined : 'surface.hover' },
                  '&:hover .crossing-rule-delete': { opacity: 1 }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <ZoneSelect
                    zones={zones}
                    value={rule.from_zone_id ?? null}
                    onChange={(zoneId) => onChangeRule(rule.id, { from_zone_id: zoneId })}
                  />
                  <Symbol
                    name="arrow_forward"
                    size={16}
                    sx={{ color: 'text.disabled', flexShrink: 0 }}
                  />
                  <ZoneSelect
                    zones={zones}
                    value={rule.to_zone_id ?? null}
                    onChange={(zoneId) => onChangeRule(rule.id, { to_zone_id: zoneId })}
                  />
                </Box>
                <Typography
                  variant="mono"
                  sx={{ fontSize: 18, fontWeight: 600, minWidth: 32, textAlign: 'right' }}
                >
                  {result?.count ?? 0}
                </Typography>
                <IconButton
                  className="crossing-rule-delete"
                  title="Delete rule"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveRule(rule.id)
                  }}
                  sx={{
                    width: 26,
                    height: 26,
                    color: 'text.disabled',
                    opacity: 0,
                    transition: 'opacity 0.1s',
                    '&:hover': { color: 'error.main' }
                  }}
                >
                  <Symbol name="delete" size={16} />
                </IconButton>
              </Box>
              {selected ? (
                <CrossingEventsList
                  zones={zones}
                  events={result?.events ?? []}
                  recordedAt={recordedAt}
                  onEventClick={onEventClick}
                />
              ) : null}
            </Box>
          )
        })
      )}
    </Box>
  )
}

function ZoneSelect({
  zones,
  value,
  onChange
}: {
  zones: readonly Zone[]
  value: string | null
  onChange: (zoneId: string | null) => void
}): React.JSX.Element {
  const theme = useTheme()

  const handleChange = (e: SelectChangeEvent<string>): void => {
    onChange(e.target.value === ANY_ZONE_VALUE ? null : e.target.value)
  }

  const swatchColor = (zoneId: string | null): string | null => {
    const index = zoneColorIndex(zones, zoneId)
    return index != null ? (theme.palette.zones[index] ?? null) : null
  }

  return (
    <Select<string>
      size="small"
      value={value ?? ANY_ZONE_VALUE}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      renderValue={(v) => {
        const zoneId = v === ANY_ZONE_VALUE ? null : v
        const color = swatchColor(zoneId)
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {color ? (
              <Box
                component="span"
                sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: color, flexShrink: 0 }}
              />
            ) : null}
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {zoneLabel(zones, zoneId)}
            </Box>
          </Box>
        )
      }}
      sx={{ height: 30, fontSize: 12.5, minWidth: 96, maxWidth: 160 }}
    >
      <MenuItem value={ANY_ZONE_VALUE}>{ANY_ZONE_LABEL}</MenuItem>
      {zones.map((zone) => (
        <MenuItem key={zone.id} value={zone.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                width: 9,
                height: 9,
                borderRadius: '2px',
                bgcolor: theme.palette.zones[zone.color_index % theme.palette.zones.length],
                flexShrink: 0
              }}
            />
            {zone.name}
          </Box>
        </MenuItem>
      ))}
    </Select>
  )
}

function CrossingEventsList({
  zones,
  events,
  recordedAt,
  onEventClick
}: {
  zones: readonly Zone[]
  events: readonly CrossingEvent[]
  recordedAt: string | null
  onEventClick: (event: CrossingEvent) => void
}): React.JSX.Element {
  const theme = useTheme()
  const colorOf = (zoneId: string): string => {
    const index = zoneColorIndex(zones, zoneId)
    return index != null
      ? (theme.palette.zones[index] ?? theme.palette.text.disabled)
      : theme.palette.text.disabled
  }

  if (events.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.25, pl: 4, fontSize: 12, color: 'text.disabled' }}>
        No events yet for this rule.
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
      {events.map((event, i) => (
        <Box
          key={`${event.frame}-${i}`}
          onClick={() => onEventClick(event)}
          sx={{
            display: 'grid',
            gridTemplateColumns: '96px minmax(0,1fr)',
            alignItems: 'center',
            gap: 1.25,
            pl: 4,
            pr: 2,
            py: 0.625,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'surface.hover' }
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <Typography variant="mono" sx={{ fontSize: 11.5 }}>
              {formatVideoTime(event.time_s)}
            </Typography>
            <Typography variant="mono" sx={{ fontSize: 10, color: 'text.disabled' }}>
              {recordedAt ? formatClockTime(recordedAt, event.time_s, { ms: true }) : ''}
            </Typography>
          </Box>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.625, fontSize: 12, minWidth: 0 }}
          >
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '2px',
                bgcolor: colorOf(event.from_zone_id),
                flexShrink: 0
              }}
            />
            <Box
              component="span"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {zoneLabel(zones, event.from_zone_id)}
            </Box>
            <Symbol name="arrow_forward" size={13} sx={{ color: 'text.disabled', flexShrink: 0 }} />
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '2px',
                bgcolor: colorOf(event.to_zone_id),
                flexShrink: 0
              }}
            />
            <Box
              component="span"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {zoneLabel(zones, event.to_zone_id)}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
