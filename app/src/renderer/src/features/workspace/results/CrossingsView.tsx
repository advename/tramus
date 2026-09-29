import Box from '@mui/material/Box'

import type {
  AnalysisSettings,
  CrossingEvent,
  CrossingRule,
  Results,
  Setup
} from '../../../api/types'
import { EmptyState } from '../../../components/EmptyState'
import { useSetupEditor } from '../data'
import { defaultCrossingRule, findRuleForPair, newCrossingRuleId } from '../lib/crossings'
import { useWorkspaceStore } from '../state/workspaceStore'
import { CrossingMatrix } from './CrossingMatrix'
import { CrossingRulesCard } from './CrossingRulesCard'

export interface CrossingsViewProps {
  videoId: string
  setup: Setup
  results: Results
  recordedAt: string | null
}

/** `Setup.analysis` is optional in the type (older/partial payloads); the session document
 * always populates it in practice (`_empty_document` in the engine), but this keeps the view
 * type-safe without assuming so. Matches `DetectionSection`'s fallback. */
const DEFAULT_ANALYSIS: AnalysisSettings = { in_zone_threshold: 0.5, crossing_rules: [] }

/**
 * Results › Crossings: the crossing-rule editor (design: reuses the Summary table's card chrome)
 * plus the from×to crossing matrix. Rule edits go through `useSetupEditor` so results refresh
 * automatically (`docs/architecture.md` §4, §5.7); the selected rule also drives the timeline's
 * crossing markers (`selectedCrossingRuleId`, see `timeline/CrossingMarkers.tsx`).
 */
export function CrossingsView({
  videoId,
  setup,
  results,
  recordedAt
}: CrossingsViewProps): React.JSX.Element {
  const editor = useSetupEditor(videoId)
  const selectedRuleId = useWorkspaceStore((s) => s.selectedCrossingRuleId)
  const selectRule = useWorkspaceStore((s) => s.selectCrossingRule)
  const seek = useWorkspaceStore((s) => s.seek)

  const zones = setup.zones ?? []
  const analysis = setup.analysis ?? DEFAULT_ANALYSIS
  const rules = analysis.crossing_rules ?? []
  const crossings = results.crossings ?? []
  const matrix = results.crossing_matrix ?? []

  if (zones.length < 2) {
    return (
      <EmptyState
        icon="swap_horiz"
        title="Add at least two zones"
        description="Crossing rules count transitions from one zone to another, so this needs two or more zones in Setup."
      />
    )
  }

  const commitRules = (next: CrossingRule[], label: string): void => {
    void editor.commit({ ...setup, analysis: { ...analysis, crossing_rules: next } }, label)
  }

  const handleAddRule = (): void => {
    const rule = defaultCrossingRule(zones, rules)
    commitRules([...rules, rule], 'Add crossing rule')
    selectRule(rule.id)
  }

  const handleRemoveRule = (ruleId: string): void => {
    commitRules(
      rules.filter((r) => r.id !== ruleId),
      'Remove crossing rule'
    )
    if (selectedRuleId === ruleId) selectRule(null)
  }

  const handleChangeRule = (ruleId: string, patch: Partial<CrossingRule>): void => {
    commitRules(
      rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
      'Edit crossing rule'
    )
  }

  const handleCellClick = (fromZoneId: string, toZoneId: string): void => {
    const existing = findRuleForPair(rules, fromZoneId, toZoneId)
    if (existing) {
      selectRule(existing.id)
      return
    }
    const rule: CrossingRule = {
      id: newCrossingRuleId(),
      from_zone_id: fromZoneId,
      to_zone_id: toZoneId
    }
    commitRules([...rules, rule], 'Add crossing rule')
    selectRule(rule.id)
  }

  const handleEventClick = (event: CrossingEvent): void => seek(event.frame)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <CrossingRulesCard
        zones={zones}
        rules={rules}
        crossings={crossings}
        recordedAt={recordedAt}
        selectedRuleId={selectedRuleId}
        onSelectRule={selectRule}
        onAddRule={handleAddRule}
        onRemoveRule={handleRemoveRule}
        onChangeRule={handleChangeRule}
        onEventClick={handleEventClick}
      />
      <CrossingMatrix
        zones={zones}
        matrix={matrix}
        rules={rules}
        selectedRuleId={selectedRuleId}
        onCellClick={handleCellClick}
      />
    </Box>
  )
}
