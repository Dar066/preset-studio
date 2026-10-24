/**
 * Undo/redo history as plain data plus pure functions.
 *
 *   past:   [oldest … newest]   ← undo pops from the end
 *   future: [newest … oldest]   ← redo pops from the end
 *
 * Each entry stores the document BEFORE a change, plus a label for the UI
 * ("Undo Brightness"). Rapid edits with the same coalesce key (one slider
 * drag fires ~60 changes a second) merge into a single entry.
 */

export interface HistoryEntry<T> {
  doc: T
  label: string
  /** edits with the same key, close together in time, merge into one step */
  key?: string
  /** last time this entry was touched (ms) */
  at: number
}

export interface History<T> {
  past: HistoryEntry<T>[]
  future: HistoryEntry<T>[]
}

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] })

const LIMIT = 100 // oldest steps drop off after this
const COALESCE_MS = 800

/** Call BEFORE applying a change, with the document as it is now. */
export function record<T>(history: History<T>, before: T, label: string, key?: string, now: number = Date.now()): History<T> {
  const top = history.past[history.past.length - 1]
  if (key && top?.key === key && now - top.at < COALESCE_MS) {
    // Same gesture still going: keep the original "before", just extend the window
    return { past: [...history.past.slice(0, -1), { ...top, at: now }], future: [] }
  }
  const past = [...history.past, { doc: before, label, key, at: now }].slice(-LIMIT)
  return { past, future: [] } // a new edit makes the old redo branch unreachable
}

export interface Step<T> {
  history: History<T>
  doc: T
  label: string
}

export function undo<T>(history: History<T>, current: T): Step<T> | null {
  const entry = history.past[history.past.length - 1]
  if (!entry) return null
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, { doc: current, label: entry.label, at: 0 }],
    },
    doc: entry.doc,
    label: entry.label,
  }
}

export function redo<T>(history: History<T>, current: T): Step<T> | null {
  const entry = history.future[history.future.length - 1]
  if (!entry) return null
  return {
    history: {
      past: [...history.past, { doc: current, label: entry.label, at: 0 }],
      future: history.future.slice(0, -1),
    },
    doc: entry.doc,
    label: entry.label,
  }
}
