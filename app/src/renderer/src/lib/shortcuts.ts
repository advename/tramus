import { useEffect, useRef } from 'react'

import { isMac } from './platform'

/**
 * Keyboard shortcuts, shared by every feature. A combo is a `+`-joined string of modifiers and
 * one key, lowercase, e.g. `"mod+s"`, `"mod+shift+z"`, `"esc"`, `"["`, `"i"`. `"mod"` is Ctrl on
 * Windows/Linux and Cmd (⌘) on macOS — use it for every app-level shortcut (Save, Undo, Track…)
 * instead of `"ctrl"`, which is a literal Control key press.
 */

const KEY_ALIASES: Record<string, string> = {
  space: ' ',
  esc: 'escape',
  del: 'delete',
  enter: 'enter',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown'
}

interface ParsedCombo {
  mod: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const key = parts[parts.length - 1] ?? ''
  const modifiers = parts.slice(0, -1)
  return {
    mod: modifiers.includes('mod'),
    ctrl: modifiers.includes('ctrl'),
    shift: modifiers.includes('shift'),
    alt: modifiers.includes('alt'),
    key: KEY_ALIASES[key] ?? key
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function matches(parsed: ParsedCombo, event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase()
  if (key !== parsed.key) return false

  const modPressed = isMac() ? event.metaKey : event.ctrlKey
  if (parsed.mod !== modPressed) return false
  if (!parsed.mod && parsed.ctrl !== event.ctrlKey) return false
  if (parsed.alt !== event.altKey) return false

  // event.key already reflects Shift for symbol/digit keys (Shift+[ is "{", not "["), so only
  // single letters need an explicit check — otherwise Shift+A would also fire an "a" shortcut.
  const isLetterKey = /^[a-z]$/.test(parsed.key)
  if (isLetterKey && parsed.shift !== event.shiftKey) return false
  if (!isLetterKey && parsed.shift && !event.shiftKey) return false

  return true
}

export interface UseShortcutOptions {
  /** Default `true`. Set `false` to temporarily disable without unmounting the hook. */
  enabled?: boolean
  /** Default `true`. Calls `event.preventDefault()` when the shortcut fires. */
  preventDefault?: boolean
}

/**
 * Fires `handler` when `combo` is pressed, anywhere except an editable element (input, textarea,
 * select, contenteditable) — so typing "i" in a text field never triggers a shortcut named "i".
 */
export function useShortcut(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: UseShortcutOptions = {}
): void {
  const { enabled = true, preventDefault = true } = options
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!enabled) return undefined
    const parsed = parseCombo(combo)

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return
      if (!matches(parsed, event)) return
      if (preventDefault) event.preventDefault()
      handlerRef.current(event)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combo, enabled, preventDefault])
}

const KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  escape: 'Esc',
  delete: 'Del',
  enter: '⏎',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  ',': ','
}

/** `"mod+shift+z"` → `"⌘⇧Z"` on macOS, `"Ctrl+Shift+Z"` elsewhere. For `<ShortcutTooltip>`/`<Kbd>`. */
export function formatShortcut(combo: string): string {
  const mac = isMac()
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const key = parts[parts.length - 1] ?? ''
  const modifiers = parts.slice(0, -1)

  const modLabels = modifiers.map((mod) => {
    switch (mod) {
      case 'mod':
        return mac ? '⌘' : 'Ctrl'
      case 'ctrl':
        return 'Ctrl'
      case 'shift':
        return mac ? '⇧' : 'Shift'
      case 'alt':
        return mac ? '⌥' : 'Alt'
      default:
        return mod
    }
  })

  const keyLabel = KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : capitalize(key))
  return mac ? [...modLabels, keyLabel].join('') : [...modLabels, keyLabel].join('+')
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1)
}
