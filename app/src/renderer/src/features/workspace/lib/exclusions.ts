/**
 * Pure helpers for `Setup.exclusions` (`docs/architecture.md` §4, §5.5): periods subtracted from
 * the trial before analysis. Time is video-time seconds, as on `Exclusion` itself; callers convert
 * to/from frames (see `lib/frames.ts`) at the edges — these helpers never touch frame indices.
 */
import type { Exclusion } from '../../../api/types'

/** A merged/moved exclusion never collapses to zero or negative length. */
const MIN_EXCLUSION_S = 0.001

/** A random 12 hex char id, matching the engine's `new_id()` (see `docs/architecture.md` §3) —
 * same pattern as `lib/zones.ts`'s `newZoneId`. */
export function newExclusionId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

/** Sum of every exclusion's length — the "excluded" total shown in the inspector. Exclusions are
 * kept merged (non-overlapping) by every helper below, so this is a plain sum, not a union. */
export function exclusionsTotalS(exclusions: readonly Exclusion[]): number {
  return exclusions.reduce((sum, e) => sum + Math.max(0, e.end_s - e.start_s), 0)
}

/** The exclusion covering time `t`, if any — e.g. to show a stage badge for the current frame. */
export function exclusionAtTime(
  exclusions: readonly Exclusion[],
  t: number
): Exclusion | undefined {
  return exclusions.find((e) => t >= e.start_s && t < e.end_s)
}

function touchesOrOverlaps(a: Exclusion, b: Exclusion): boolean {
  const EPS = 1e-6
  return a.start_s <= b.end_s + EPS && b.start_s <= a.end_s + EPS
}

function combineNotes(notes: readonly (string | null | undefined)[]): string | null {
  const unique = [...new Set(notes.filter((n): n is string => Boolean(n && n.trim())))]
  return unique.length > 0 ? unique.join('; ') : null
}

/**
 * Folds `addition` into `existing`, combining it with every exclusion it overlaps or is adjacent
 * to (touching, not just intersecting) into a single entry instead of stacking duplicates. The
 * merged entry's id is whichever member starts earliest (deterministic, independent of which side
 * is "new" — so editing an exclusion's start into a left neighbour still resolves to a real id;
 * see `mergeExclusionEdge`), and its note combines every merged member's note. Result is sorted by
 * `start_s`.
 */
export function mergeExclusions(existing: readonly Exclusion[], addition: Exclusion): Exclusion[] {
  const overlapping: Exclusion[] = []
  const rest: Exclusion[] = []
  for (const exclusion of existing) {
    if (touchesOrOverlaps(exclusion, addition)) overlapping.push(exclusion)
    else rest.push(exclusion)
  }
  const group = [...overlapping, addition]
  const earliest = group.reduce((a, b) => (a.start_s <= b.start_s ? a : b))
  const merged: Exclusion = {
    id: earliest.id,
    start_s: Math.min(...group.map((e) => e.start_s)),
    end_s: Math.max(...group.map((e) => e.end_s)),
    note: combineNotes(group.map((e) => e.note))
  }
  return [...rest, merged].sort((a, b) => a.start_s - b.start_s)
}

interface MovedExclusion {
  rest: Exclusion[]
  moved: Exclusion
}

function moveOne(
  exclusions: readonly Exclusion[],
  id: string,
  side: 'start' | 'end',
  t: number
): MovedExclusion | null {
  const target = exclusions.find((e) => e.id === id)
  if (!target) return null
  const rest = exclusions.filter((e) => e.id !== id)
  const moved: Exclusion =
    side === 'start'
      ? { ...target, start_s: Math.min(t, target.end_s - MIN_EXCLUSION_S) }
      : { ...target, end_s: Math.max(t, target.start_s + MIN_EXCLUSION_S) }
  return { rest, moved }
}

/**
 * Moves one exclusion's start or end to `t`, clamped so it keeps a positive duration — no merging.
 * For live preview while dragging an edge handle (`useTimelineDrag`): merging mid-drag would risk
 * losing track of which entry is being dragged, so the drag previews an (possibly transiently
 * overlapping) move and only merges once, on release — see `mergeExclusionEdge`.
 */
export function moveExclusionEdge(
  exclusions: readonly Exclusion[],
  id: string,
  side: 'start' | 'end',
  t: number
): Exclusion[] {
  const result = moveOne(exclusions, id, side, t)
  if (!result) return exclusions as Exclusion[]
  return [...result.rest, result.moved].sort((a, b) => a.start_s - b.start_s)
}

/**
 * Like `moveExclusionEdge`, but also merges the moved exclusion with anything it now overlaps or
 * touches — call once, when an edge drag ends. Returns the resulting id too: a merge can hand the
 * id to a different (earlier-starting) member — see `mergeExclusions` — so the caller can keep
 * selecting the right entry after the drag.
 */
export function mergeExclusionEdge(
  exclusions: readonly Exclusion[],
  id: string,
  side: 'start' | 'end',
  t: number
): { exclusions: Exclusion[]; id: string } {
  const result = moveOne(exclusions, id, side, t)
  if (!result) return { exclusions: exclusions as Exclusion[], id }
  const merged = mergeExclusions(result.rest, result.moved)
  const EPS = 1e-6
  const winner =
    merged.find(
      (e) => e.start_s <= result.moved.start_s + EPS && e.end_s >= result.moved.end_s - EPS
    )?.id ?? id
  return { exclusions: merged, id: winner }
}
