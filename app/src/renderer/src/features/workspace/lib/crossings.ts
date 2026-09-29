/**
 * Pure helpers for the Results › Crossings view: rule/zone labelling, matrix lookups and heat
 * shading. See `docs/architecture.md` §5.7 and §4 (`CrossingRule`, `Results.crossings`,
 * `Results.crossing_matrix`).
 */
import type { CrossingResult, CrossingRule, MatrixCell, Zone } from '../../../api/types'

/** Shown for a rule side (or a matrix axis) that is `null` — matches any zone. */
export const ANY_ZONE_LABEL = 'Any zone'

/** A random 12 hex char id, matching the engine's `new_id()` — same pattern as `newZoneId`
 * (`lib/zones.ts`) and `data/editors.ts`'s correction ids. */
export function newCrossingRuleId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

/** The zone's name for a rule's `from_zone_id`/`to_zone_id`, or "Any zone" when it's `null`
 * (or the id no longer matches a zone). */
export function zoneLabel(zones: readonly Zone[], zoneId: string | null | undefined): string {
  if (!zoneId) return ANY_ZONE_LABEL
  return zones.find((z) => z.id === zoneId)?.name ?? ANY_ZONE_LABEL
}

/** The zone's palette index for a swatch, or `null` for "Any zone" / an unknown id. */
export function zoneColorIndex(
  zones: readonly Zone[],
  zoneId: string | null | undefined
): number | null {
  if (!zoneId) return null
  return zones.find((z) => z.id === zoneId)?.color_index ?? null
}

/** A new rule defaulting to the first two zones (the caller ensures there are at least two —
 * see the Crossings view's empty state). */
/**
 * A new rule for the first ordered pair of distinct zones that no rule covers yet (A→B, A→C, …,
 * B→A, …), so "+ Add rule" never duplicates an existing rule. Falls back to the first two zones
 * once every pair is taken.
 */
export function defaultCrossingRule(
  zones: readonly Zone[],
  existing: readonly CrossingRule[] = []
): CrossingRule {
  const taken = new Set(existing.map((r) => `${r.from_zone_id}→${r.to_zone_id}`))
  for (const from of zones) {
    for (const to of zones) {
      if (from.id !== to.id && !taken.has(`${from.id}→${to.id}`)) {
        return { id: newCrossingRuleId(), from_zone_id: from.id, to_zone_id: to.id }
      }
    }
  }
  return {
    id: newCrossingRuleId(),
    from_zone_id: zones[0]?.id ?? null,
    to_zone_id: zones[1]?.id ?? null
  }
}

/** The `CrossingResult` (count + events) matching a rule id, if results have been computed. */
export function resultForRule(
  crossings: readonly CrossingResult[] | undefined,
  ruleId: string
): CrossingResult | undefined {
  return crossings?.find((c) => c.rule_id === ruleId)
}

/** The count for one ordered zone pair from the crossing matrix (0 if not present). */
export function matrixCount(
  matrix: readonly MatrixCell[] | undefined,
  fromZoneId: string,
  toZoneId: string
): number {
  return matrix?.find((c) => c.from_zone_id === fromZoneId && c.to_zone_id === toZoneId)?.count ?? 0
}

/** The highest count in the matrix, for normalising heat shading (0 for an empty matrix). */
export function maxMatrixCount(matrix: readonly MatrixCell[] | undefined): number {
  return (matrix ?? []).reduce((max, cell) => Math.max(max, cell.count), 0)
}

/** 0–1 shading intensity for a matrix cell, relative to the matrix's highest count — 0 when the
 * cell (or the whole matrix) is empty, so a zero-count cell never gets a colour wash. */
export function heatIntensity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  return count / max
}

/** An existing rule that matches this exact concrete zone pair (both sides equal — not the
 * wildcard "Any zone" rules that would also match it). Powers the matrix's click-to-select. */
export function findRuleForPair(
  rules: readonly CrossingRule[],
  fromZoneId: string,
  toZoneId: string
): CrossingRule | undefined {
  return rules.find((r) => r.from_zone_id === fromZoneId && r.to_zone_id === toZoneId)
}
