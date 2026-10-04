import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  describeContexts,
  formatShortcutKeys,
  matchesQuery,
  SHORTCUT_GROUPS,
  SHORTCUT_LIST,
  SHORTCUTS,
  shortcutsByGroup
} from './shortcutRegistry'
import { formatShortcut } from './shortcuts'

/** The key a combo listens for, ignoring aliases such as `esc` → `escape`. */
function normalised(combo: string): string {
  return combo
    .toLowerCase()
    .replace(/\besc\b/, 'escape')
    .replace(/\bdel\b/, 'delete')
}

describe('shortcut registry', () => {
  it('lists each shortcut once, with a label', () => {
    const labelled = SHORTCUT_LIST.map((shortcut) => `${shortcut.group}/${shortcut.label}`)
    expect(new Set(labelled).size).toBe(SHORTCUT_LIST.length)
    expect(SHORTCUT_LIST.every((shortcut) => shortcut.label.trim() !== '')).toBe(true)
  })

  it('only uses declared groups', () => {
    for (const shortcut of SHORTCUT_LIST) expect(SHORTCUT_GROUPS).toContain(shortcut.group)
  })

  it('never binds one key twice in the same screen or step', () => {
    const bindings = SHORTCUT_LIST.flatMap((shortcut) =>
      [shortcut.combo, ...('alias' in shortcut && shortcut.alias ? [shortcut.alias] : [])].flatMap(
        (combo) => shortcut.active.map((context) => `${context}: ${normalised(combo)}`)
      )
    )
    const duplicates = bindings.filter((binding, index) => bindings.indexOf(binding) !== index)
    expect(duplicates).toEqual([])
  })

  it('keeps the keys the Review step documents', () => {
    expect(SHORTCUTS.acceptFlag.combo).toBe('a')
    expect(SHORTCUTS.setPosition.combo).toBe('s')
    expect(SHORTCUTS.reopenFlag.combo).toBe('r')
    expect(SHORTCUTS.nextUnresolved.combo).toBe('arrowdown')
    expect(SHORTCUTS.previousUnresolved.combo).toBe('arrowup')
  })

  it('groups shortcuts in display order, without empty groups', () => {
    const groups = shortcutsByGroup()
    expect(groups.map((entry) => entry.group)).toEqual(
      SHORTCUT_GROUPS.filter((group) => SHORTCUT_LIST.some((shortcut) => shortcut.group === group))
    )
    expect(groups.flatMap((entry) => entry.shortcuts)).toHaveLength(SHORTCUT_LIST.length)
  })
})

describe('describeContexts', () => {
  it('names where a shortcut works', () => {
    expect(describeContexts(SHORTCUTS.goToLibrary.active)).toBe('Everywhere')
    expect(describeContexts(SHORTCUTS.save.active)).toBe('Every step')
    expect(describeContexts(SHORTCUTS.trialStart.active)).toBe('Setup, Review')
    expect(describeContexts(SHORTCUTS.searchVideos.active)).toBe('Library')
  })
})

describe('matchesQuery', () => {
  it('matches the label, group, keys and where it works, ignoring case', () => {
    expect(matchesQuery(SHORTCUTS.acceptFlag, 'ACCEPT')).toBe(true)
    expect(matchesQuery(SHORTCUTS.acceptFlag, 'review & correct')).toBe(true)
    expect(matchesQuery(SHORTCUTS.acceptFlag, 'tracking')).toBe(false)
    expect(matchesQuery(SHORTCUTS.acceptFlag, '  ')).toBe(true)
    expect(matchesQuery(SHORTCUTS.deleteSelection, 'backspace')).toBe(true)
  })
})

describe('formatting on each platform', () => {
  afterEach(() => vi.unstubAllGlobals())

  const onPlatform = (userAgent: string): void => {
    vi.stubGlobal('navigator', { userAgent })
  }

  it('uses symbols on macOS', () => {
    onPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
    expect(formatShortcut('mod+shift+z')).toBe('⌘⇧Z')
    expect(formatShortcut('mod+[')).toBe('⌘[')
    expect(formatShortcut('arrowdown')).toBe('↓')
    expect(formatShortcutKeys(SHORTCUTS.deleteSelection)).toBe('Del / Backspace')
  })

  it('spells modifiers out on Windows and Linux', () => {
    onPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    expect(formatShortcut('mod+shift+z')).toBe('Ctrl+Shift+Z')
    expect(formatShortcut('mod+,')).toBe('Ctrl+,')
    expect(formatShortcut('space')).toBe('Space')
    onPlatform('Mozilla/5.0 (X11; Linux x86_64)')
    expect(formatShortcutKeys(SHORTCUTS.save)).toBe('Ctrl+S')
  })
})
