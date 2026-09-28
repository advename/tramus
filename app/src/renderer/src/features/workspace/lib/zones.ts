import type { Zone } from '../../../api/types'

/** `palette.zones` has 8 entries; colours are assigned round-robin as zones are created. */
export const ZONE_COLOR_COUNT = 8

/** The first colour index not currently used by another zone (falls back to round-robin). */
export function nextZoneColorIndex(zones: readonly Zone[]): number {
  const used = new Set(zones.map((z) => z.color_index))
  for (let i = 0; i < ZONE_COLOR_COUNT; i++) {
    if (!used.has(i)) return i
  }
  return zones.length % ZONE_COLOR_COUNT
}

/** `"Zone 1"`, `"Zone 2"`, … — the first name not already taken. */
export function nextZoneName(zones: readonly Zone[]): string {
  const used = new Set(zones.map((z) => z.name))
  let n = zones.length + 1
  while (used.has(`Zone ${n}`)) n++
  return `Zone ${n}`
}

/** A random 12 hex char id, matching the engine's `new_id()` (see `docs/architecture.md` §3). */
export function newZoneId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

/**
 * Bulk toggle for a zone boolean flag (`visible` or `locked`), used by the Zones list header's
 * hide-all/show-all and lock-all/unlock-all buttons: turn the flag off for every zone if any zone
 * currently has it on, else turn it on for every zone. Returns the value to assign to all zones.
 */
export function nextBulkToggle(zones: readonly Zone[], key: 'visible' | 'locked'): boolean {
  return !zones.some((zone) => zone[key])
}

/** Topmost zone (last in list) whose shape contains `p` and that isn't hidden. */
export function findZoneAt(
  zones: readonly Zone[],
  hitTest: (zone: Zone) => boolean
): Zone | undefined {
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i]!
    if (zone.visible && hitTest(zone)) return zone
  }
  return undefined
}
