import type { Template } from '../../api/types'
import { formatDate, formatShortDuration } from '../../lib/time'

/** `"Arena + 4 zones · trial 5:00 · scale set · 1600 × 1362"` — the one-line description under a
 * template's name. */
export function formatTemplateMeta(template: Template): string {
  const zoneCount = template.zones?.length ?? 0
  const zoneWord = zoneCount === 1 ? 'zone' : 'zones'
  const shapesPart = template.arena
    ? zoneCount > 0
      ? `Arena + ${zoneCount} ${zoneWord}`
      : 'Arena, no zones'
    : zoneCount > 0
      ? `${zoneCount} ${zoneWord}, no arena`
      : 'No arena or zones'
  const trialPart =
    template.trial_duration_s != null
      ? `trial ${formatShortDuration(template.trial_duration_s)}`
      : 'no trial length'
  const sizePart = `${template.reference_width} × ${template.reference_height}`
  const parts = [shapesPart, trialPart]
  if (template.calibration) parts.push('scale set')
  parts.push(sizePart)
  return parts.join(' · ')
}

/** `"Saved 24 Sep 2026 by J. Okafor"`. */
export function formatTemplateSaved(template: Template): string {
  return `Saved ${formatDate(template.created_at)} by ${template.created_by}`
}
