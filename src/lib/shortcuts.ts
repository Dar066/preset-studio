/**
 * Keyboard shortcut engine: actions, layouts, and key-combo helpers.
 *
 * A combo is a string like "Mod+Shift+3". "Mod" means Cmd on macOS and Ctrl
 * elsewhere, so one layout works on both platforms, as NLE layouts do.
 * Keys come from KeyboardEvent.code (physical key position), so shortcuts
 * don't move around on AZERTY or other keyboard layouts.
 */

export type ActionId =
  | 'playPause'
  | 'pause'
  | 'playForward'
  | 'rewind'
  | 'forward'
  | 'stepBack'
  | 'stepForward'
  | 'goStart'
  | 'goEnd'
  | 'prevEdit'
  | 'nextEdit'
  | 'applyTransition'
  | 'previewTransition'
  | 'showClip'
  | 'showSequence'
  | 'compareHold'
  | 'resetGrade'
  | 'openShortcuts'

export type ActionGroup = 'Playback' | 'Navigate' | 'Edit' | 'View'

export interface ActionMeta {
  id: ActionId
  label: string
  group: ActionGroup
  /** fire again while the key is held (e.g. frame stepping) */
  repeat?: boolean
  /** active only while held down (e.g. compare) */
  hold?: boolean
}

export const ACTIONS: ActionMeta[] = [
  { id: 'playPause', label: 'Play / pause', group: 'Playback' },
  { id: 'pause', label: 'Stop', group: 'Playback' },
  { id: 'playForward', label: 'Play forward', group: 'Playback' },
  { id: 'rewind', label: 'Back 1 second', group: 'Playback', repeat: true },
  { id: 'forward', label: 'Forward 1 second', group: 'Playback', repeat: true },
  { id: 'stepBack', label: 'Back 1 frame', group: 'Navigate', repeat: true },
  { id: 'stepForward', label: 'Forward 1 frame', group: 'Navigate', repeat: true },
  { id: 'goStart', label: 'Go to start', group: 'Navigate' },
  { id: 'goEnd', label: 'Go to end', group: 'Navigate' },
  { id: 'prevEdit', label: 'Previous edit point', group: 'Navigate' },
  { id: 'nextEdit', label: 'Next edit point', group: 'Navigate' },
  { id: 'applyTransition', label: 'Apply default transition', group: 'Edit' },
  { id: 'previewTransition', label: 'Preview transition', group: 'Edit' },
  { id: 'resetGrade', label: 'Reset color grade', group: 'Edit' },
  { id: 'showClip', label: 'Show clip (source)', group: 'View' },
  { id: 'showSequence', label: 'Show sequence (timeline)', group: 'View' },
  { id: 'compareHold', label: 'Compare with original (hold)', group: 'View', hold: true },
  { id: 'openShortcuts', label: 'Keyboard shortcuts', group: 'View' },
]

export const ACTION_GROUPS: ActionGroup[] = ['Playback', 'Navigate', 'Edit', 'View']

export type Bindings = Record<ActionId, string | null>

export const DEFAULT_BINDINGS: Bindings = {
  playPause: 'Space',
  pause: null,
  playForward: null,
  rewind: 'Shift+Left',
  forward: 'Shift+Right',
  stepBack: 'Left',
  stepForward: 'Right',
  goStart: 'Home',
  goEnd: 'End',
  prevEdit: '[',
  nextEdit: ']',
  applyTransition: 'T',
  previewTransition: 'P',
  resetGrade: 'Shift+R',
  showClip: '1',
  showSequence: '2',
  compareHold: 'C',
  openShortcuts: 'Shift+/',
}

export type LayoutId = 'default' | 'premiere' | 'fcp'

export interface Layout {
  id: LayoutId
  name: string
  description: string
  /** only the actions this app shares with the editor; everything else keeps its default */
  bindings: Partial<Bindings>
}

export const LAYOUTS: Layout[] = [
  {
    id: 'default',
    name: 'Preset Studio',
    description: 'Built-in defaults',
    bindings: {},
  },
  {
    id: 'premiere',
    name: 'Premiere Pro',
    description: 'Adobe Premiere Pro default layout',
    bindings: {
      rewind: 'J',
      pause: 'K',
      playForward: 'L',
      prevEdit: 'Up',
      nextEdit: 'Down',
      applyTransition: 'Mod+D', // Apply Video Transition
      showClip: 'Shift+2', // Source Monitor
      showSequence: 'Shift+3', // Timeline
      openShortcuts: 'Mod+Alt+K', // Keyboard Shortcuts
    },
  },
  {
    id: 'fcp',
    name: 'Final Cut Pro',
    description: 'Apple Final Cut Pro default layout',
    bindings: {
      rewind: 'J',
      pause: 'K',
      playForward: 'L',
      prevEdit: 'Up',
      nextEdit: 'Down',
      applyTransition: 'Mod+T', // Add Cross Dissolve
      showClip: 'Mod+1', // Go to Browser
      showSequence: 'Mod+2', // Go to Timeline
      openShortcuts: 'Mod+Alt+K', // Command Editor
    },
  },
]

/**
 * Combos the browser keeps for itself (new tab, close tab, switch tab, ...).
 * A web page can't intercept these, so they're never assigned.
 */
const RESERVED = new Set([
  'Mod+T', 'Mod+N', 'Mod+W', 'Mod+Q', 'Mod+L', 'Mod+Tab',
  'Mod+Shift+T', 'Mod+Shift+N', 'Mod+Shift+W',
  'Mod+1', 'Mod+2', 'Mod+3', 'Mod+4', 'Mod+5', 'Mod+6', 'Mod+7', 'Mod+8', 'Mod+9',
])

export const isReserved = (combo: string) => RESERVED.has(combo)

export interface ImportResult {
  bindings: Bindings
  /** actions whose binding differs from the defaults after import */
  changed: ActionId[]
  /** editor shortcuts that couldn't be used because the browser reserves them */
  skipped: { id: ActionId; combo: string }[]
}

/** Start from defaults, apply the layout, and resolve any clashes. */
export function importLayout(layoutId: LayoutId): ImportResult {
  const layout = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0]
  let bindings: Bindings = { ...DEFAULT_BINDINGS }
  const skipped: ImportResult['skipped'] = []

  for (const [id, combo] of Object.entries(layout.bindings) as [ActionId, string][]) {
    if (isReserved(combo)) {
      skipped.push({ id, combo })
      continue
    }
    bindings = assign(bindings, id, combo).bindings
  }

  const changed = ACTIONS.map((a) => a.id).filter((id) => bindings[id] !== DEFAULT_BINDINGS[id])
  return { bindings, changed, skipped }
}

/** Bind a combo to an action. A combo can only belong to one action, so any previous owner is unbound. */
export function assign(bindings: Bindings, id: ActionId, combo: string | null): { bindings: Bindings; stolenFrom: ActionId | null } {
  const next = { ...bindings }
  let stolenFrom: ActionId | null = null
  if (combo) {
    for (const a of ACTIONS) {
      if (a.id !== id && next[a.id] === combo) {
        next[a.id] = null
        stolenFrom = a.id
      }
    }
  }
  next[id] = combo
  return { bindings: next, stolenFrom }
}

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

const CODE_TO_KEY: Record<string, string> = {
  Space: 'Space',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  BracketLeft: '[',
  BracketRight: ']',
  Slash: '/',
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  Minus: '-',
  Equal: '=',
  Backquote: '`',
}

const MODIFIER_CODES = /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$/

/** Turn a keyboard event into a combo string, or null for a bare modifier press. */
export function eventToCombo(e: KeyboardEvent | { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): string | null {
  const { code } = e
  if (!code || MODIFIER_CODES.test(code)) return null

  let key = CODE_TO_KEY[code]
  if (!key) {
    if (code.startsWith('Key')) key = code.slice(3) // KeyA → A
    else if (code.startsWith('Digit')) key = code.slice(5) // Digit1 → 1
    else if (code.startsWith('Numpad')) key = `Num${code.slice(6)}`
    else key = code // Home, End, Enter, Backspace, F1 …
  }

  const parts: string[] = []
  if (IS_MAC ? e.metaKey : e.ctrlKey) parts.push('Mod')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

const KEY_LABELS: Record<string, string> = {
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
}

/** Display tokens for a combo, e.g. "Mod+Shift+3" → ["⌘", "⇧", "3"] on Mac, ["Ctrl", "Shift", "3"] elsewhere. */
export function formatCombo(combo: string, mac = IS_MAC): string[] {
  if (combo === 'Shift+/') return ['?']
  return combo.split('+').map((part) => {
    if (part === 'Mod') return mac ? '⌘' : 'Ctrl'
    if (part === 'Alt') return mac ? '⌥' : 'Alt'
    if (part === 'Shift') return mac ? '⇧' : 'Shift'
    return KEY_LABELS[part] ?? part
  })
}

export const actionLabel = (id: ActionId) => ACTIONS.find((a) => a.id === id)?.label ?? id
