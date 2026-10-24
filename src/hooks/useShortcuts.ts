import { useEffect, useRef } from 'react'
import { ACTIONS, eventToCombo } from '../lib/shortcuts'
import type { ActionId, Bindings } from '../lib/shortcuts'

export interface ShortcutHandler {
  down: () => void
  up?: () => void
}

export type ShortcutHandlers = Record<ActionId, ShortcutHandler>

/** Don't steal keys from places the user is typing or adjusting a control. */
function shouldIgnore(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    // A focused slider owns its arrow / Home / End keys
    if (type === 'range') return /^(Arrow|Home|End|Page)/.test(e.code)
    return !['checkbox', 'radio', 'button'].includes(type)
  }
  return false
}

/**
 * One global keydown/keyup listener for the whole app.
 * The listener is attached once; the latest bindings and handlers are read
 * through refs, so rebinding a key never re-registers listeners.
 */
export function useShortcuts(bindings: Bindings, handlers: ShortcutHandlers, enabled: boolean) {
  const bindingsRef = useRef(bindings)
  const handlersRef = useRef(handlers)
  const enabledRef = useRef(enabled)
  // physical key code → action currently held down (for hold actions like compare)
  const heldRef = useRef(new Map<string, ActionId>())

  useEffect(() => {
    bindingsRef.current = bindings
    handlersRef.current = handlers
    enabledRef.current = enabled
  })

  useEffect(() => {
    const releaseAll = () => {
      heldRef.current.forEach((id) => handlersRef.current[id].up?.())
      heldRef.current.clear()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current || e.defaultPrevented || shouldIgnore(e)) return
      const combo = eventToCombo(e)
      if (!combo) return

      const action = ACTIONS.find((a) => bindingsRef.current[a.id] === combo)
      if (!action) return

      e.preventDefault() // stops page scroll on Space/arrows, browser bookmark on Ctrl+D, etc.
      if (e.repeat && !action.repeat) return

      if (action.hold) heldRef.current.set(e.code, action.id)
      handlersRef.current[action.id].down()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const id = heldRef.current.get(e.code)
      if (!id) return
      heldRef.current.delete(e.code)
      handlersRef.current[id].up?.()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAll) // alt-tabbing away mid-hold shouldn't leave compare stuck on
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
    }
  }, [])
}
