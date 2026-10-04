import { formatShortcut } from './shortcuts'

/**
 * Every keyboard shortcut in the app, in one place. Call sites pass `SHORTCUTS.<id>.combo` to
 * `useShortcut` (and to `<ShortcutTooltip>`), and Settings → Keyboard shortcuts lists this table,
 * so the reference can't drift from what the keys do. Combos use the syntax of `lib/shortcuts.ts`.
 *
 * `active` says where the shortcut works, so the same key can mean different things in different
 * places (`A` accepts a flag in Review, draws the arena in Setup). Two entries may share a key
 * only when their contexts never overlap — `shortcutRegistry.test.ts` enforces it. Handlers that
 * share one meaning (e.g. Esc in the stage and in the timeline) share one entry.
 */

/** A screen, or a step of the workspace. */
export type ShortcutContext = 'start' | 'library' | 'setup' | 'tracking' | 'review' | 'results'

export type ShortcutGroup =
  | 'Global'
  | 'Library'
  | 'Tools'
  | 'Setup tools'
  | 'Review & correct'
  | 'Timeline & playback'
  | 'View & zoom'
  | 'Batch'

/** Display order of the groups. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  'Global',
  'Library',
  'Tools',
  'Setup tools',
  'Review & correct',
  'Timeline & playback',
  'View & zoom',
  'Batch'
]

export interface ShortcutDef {
  combo: string
  /** A second key for the same action, e.g. Backspace next to Delete. */
  alias?: string
  label: string
  group: ShortcutGroup
  active: readonly ShortcutContext[]
}

const EVERYWHERE = ['start', 'library', 'setup', 'tracking', 'review', 'results'] as const
const WORKSPACE = ['setup', 'tracking', 'review', 'results'] as const
const EDITING = ['setup', 'review'] as const
const NOT_TRACKING = ['setup', 'review', 'results'] as const

export const SHORTCUTS = {
  // Global
  goToLibrary: { combo: 'mod+1', label: 'Library', group: 'Global', active: EVERYWHERE },
  goToTemplates: { combo: 'mod+2', label: 'Templates', group: 'Global', active: EVERYWHERE },
  goToBatch: { combo: 'mod+3', label: 'Batch', group: 'Global', active: EVERYWHERE },
  openSettings: { combo: 'mod+,', label: 'Settings', group: 'Global', active: EVERYWHERE },
  openFolder: {
    combo: 'mod+o',
    label: 'Open folder',
    group: 'Global',
    active: ['start', 'library']
  },
  save: { combo: 'mod+s', label: 'Save', group: 'Global', active: WORKSPACE },
  undo: { combo: 'mod+z', label: 'Undo', group: 'Global', active: WORKSPACE },
  redo: { combo: 'mod+shift+z', label: 'Redo', group: 'Global', active: WORKSPACE },
  track: { combo: 'mod+t', label: 'Track', group: 'Global', active: WORKSPACE },
  cancelTracking: {
    combo: 'escape',
    label: 'Cancel tracking',
    group: 'Global',
    active: ['tracking']
  },

  // Library
  searchVideos: {
    combo: 'mod+f',
    label: 'Search videos',
    group: 'Library',
    active: ['library']
  },
  tableView: { combo: 'mod+shift+1', label: 'Table view', group: 'Library', active: ['library'] },
  gridView: { combo: 'mod+shift+2', label: 'Grid view', group: 'Library', active: ['library'] },
  trackSelected: {
    combo: 'mod+t',
    label: 'Track the selected videos in Batch',
    group: 'Library',
    active: ['library']
  },
  clearSelection: {
    combo: 'escape',
    label: 'Clear the selection',
    group: 'Library',
    active: ['library']
  },

  // Tools (the stage tool palette)
  toolSelect: { combo: 'v', label: 'Select / move', group: 'Tools', active: EDITING },
  toolPan: { combo: 'h', label: 'Pan', group: 'Tools', active: EDITING },
  deleteSelection: {
    combo: 'delete',
    alias: 'backspace',
    label: 'Delete the selected zone or excluded period',
    group: 'Tools',
    active: NOT_TRACKING
  },
  cancel: {
    combo: 'escape',
    label: 'Cancel drawing, or clear the selected range',
    group: 'Tools',
    active: NOT_TRACKING
  },

  // Setup tools
  toolArena: { combo: 'a', label: 'Arena outline', group: 'Setup tools', active: ['setup'] },
  toolRect: { combo: 'r', label: 'Rectangle zone', group: 'Setup tools', active: ['setup'] },
  toolEllipse: { combo: 'e', label: 'Ellipse zone', group: 'Setup tools', active: ['setup'] },
  toolPolygon: { combo: 'g', label: 'Polygon zone', group: 'Setup tools', active: ['setup'] },
  toolMeasure: {
    combo: 'm',
    label: 'Measure distance',
    group: 'Setup tools',
    active: ['setup']
  },

  // Review & correct
  acceptFlag: {
    combo: 'a',
    label: 'Accept the flag',
    group: 'Review & correct',
    active: ['review']
  },
  setPosition: {
    combo: 's',
    label: 'Set position (click the mouse)',
    group: 'Review & correct',
    active: ['review']
  },
  reopenFlag: {
    combo: 'r',
    label: 'Reopen the flag',
    group: 'Review & correct',
    active: ['review']
  },
  markNotVisible: {
    combo: 'n',
    label: 'Mouse not visible in the selected range',
    group: 'Review & correct',
    active: ['review']
  },
  fillBetween: {
    combo: 'f',
    label: 'Fill in between for the selected range',
    group: 'Review & correct',
    active: ['review']
  },
  nextUnresolved: {
    combo: 'arrowdown',
    alias: 'enter',
    label: 'Next unresolved flag',
    group: 'Review & correct',
    active: ['review']
  },
  previousUnresolved: {
    combo: 'arrowup',
    label: 'Previous unresolved flag',
    group: 'Review & correct',
    active: ['review']
  },
  previousFlag: {
    combo: '[',
    label: 'Previous flag',
    group: 'Review & correct',
    active: ['review']
  },
  nextFlag: { combo: ']', label: 'Next flag', group: 'Review & correct', active: ['review'] },

  // Timeline & playback
  playPause: {
    combo: 'space',
    label: 'Play / pause',
    group: 'Timeline & playback',
    active: WORKSPACE
  },
  previousFrame: {
    combo: 'arrowleft',
    label: 'Previous frame',
    group: 'Timeline & playback',
    active: WORKSPACE
  },
  nextFrame: {
    combo: 'arrowright',
    label: 'Next frame',
    group: 'Timeline & playback',
    active: WORKSPACE
  },
  back1s: {
    combo: 'shift+arrowleft',
    label: 'Back 1 second',
    group: 'Timeline & playback',
    active: WORKSPACE
  },
  forward1s: {
    combo: 'shift+arrowright',
    label: 'Forward 1 second',
    group: 'Timeline & playback',
    active: WORKSPACE
  },
  trialStart: {
    combo: 'i',
    label: 'Set trial start here',
    group: 'Timeline & playback',
    active: EDITING
  },
  trialEnd: {
    combo: 'o',
    label: 'Set trial end here',
    group: 'Timeline & playback',
    active: EDITING
  },
  excludeRange: {
    combo: 'x',
    label: 'Exclude the selected range',
    group: 'Timeline & playback',
    active: NOT_TRACKING
  },

  // View & zoom
  toggleStageView: {
    combo: 'b',
    label: 'Switch between video and tracker view',
    group: 'View & zoom',
    active: ['setup', 'tracking']
  },
  toggleTrail: {
    combo: 't',
    label: 'Show / hide the trail',
    group: 'View & zoom',
    active: ['review']
  },
  toggleHeatmap: {
    combo: 'm',
    label: 'Show / hide the heatmap',
    group: 'View & zoom',
    active: ['review']
  },
  toggleOutline: {
    combo: 'l',
    label: 'Show / hide the mouse outline',
    group: 'View & zoom',
    active: ['review']
  },
  toggleCurrentZone: {
    combo: 'z',
    label: 'Highlight the current zone',
    group: 'View & zoom',
    active: ['review']
  },
  zoomIn: { combo: 'mod+=', label: 'Zoom in', group: 'View & zoom', active: WORKSPACE },
  zoomOut: { combo: 'mod+-', label: 'Zoom out', group: 'View & zoom', active: WORKSPACE },
  zoomFit: { combo: 'mod+0', label: 'Fit to window', group: 'View & zoom', active: WORKSPACE },

  // Batch (reviewing a batch's videos in turn)
  previousVideo: {
    combo: 'mod+[',
    label: 'Previous video in the batch',
    group: 'Batch',
    active: WORKSPACE
  },
  nextVideo: { combo: 'mod+]', label: 'Next video in the batch', group: 'Batch', active: WORKSPACE }
} as const satisfies Record<string, ShortcutDef>

export type ShortcutId = keyof typeof SHORTCUTS

/** Every entry with its id, for lists and tests. */
export const SHORTCUT_LIST: readonly (ShortcutDef & { id: ShortcutId })[] = (
  Object.entries(SHORTCUTS) as [ShortcutId, ShortcutDef][]
).map(([id, def]) => ({ id, ...def }))

/** The entries of each group, in display order; empty groups are left out. */
export function shortcutsByGroup(
  list: readonly (ShortcutDef & { id: ShortcutId })[] = SHORTCUT_LIST
): { group: ShortcutGroup; shortcuts: (ShortcutDef & { id: ShortcutId })[] }[] {
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    shortcuts: list.filter((shortcut) => shortcut.group === group)
  })).filter((entry) => entry.shortcuts.length > 0)
}

/** `"⌘S"` / `"Ctrl+S"`; with an alias `"Del / Backspace"`. */
export function formatShortcutKeys(def: Pick<ShortcutDef, 'combo' | 'alias'>): string {
  return [def.combo, def.alias]
    .filter((combo) => combo !== undefined)
    .map(formatShortcut)
    .join(' / ')
}

const CONTEXT_NAMES: Record<ShortcutContext, string> = {
  start: 'Start',
  library: 'Library',
  setup: 'Setup',
  tracking: 'Tracking',
  review: 'Review',
  results: 'Results'
}

/** Where a shortcut works: `"Everywhere"`, `"Library"`, `"Setup, Review"`, … */
export function describeContexts(active: readonly ShortcutContext[]): string {
  const sameAs = (set: readonly ShortcutContext[]): boolean =>
    set.length === active.length && set.every((context) => active.includes(context))
  if (sameAs(EVERYWHERE)) return 'Everywhere'
  if (sameAs(WORKSPACE)) return 'Every step'
  return active.map((context) => CONTEXT_NAMES[context]).join(', ')
}

/** Whether a shortcut matches a search: its label, group, keys or where it works. */
export function matchesQuery(
  shortcut: Pick<ShortcutDef, 'combo' | 'alias' | 'label' | 'group' | 'active'>,
  query: string
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [
    shortcut.label,
    shortcut.group,
    formatShortcutKeys(shortcut),
    describeContexts(shortcut.active)
  ].some((text) => text.toLowerCase().includes(needle))
}
