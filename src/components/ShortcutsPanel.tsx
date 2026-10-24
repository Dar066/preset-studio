import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ACTIONS,
  ACTION_GROUPS,
  LAYOUTS,
  actionLabel,
  eventToCombo,
  formatCombo,
  isReserved,
} from '../lib/shortcuts'
import type { ActionId, Bindings, ImportResult, LayoutId } from '../lib/shortcuts'

export interface ShortcutState {
  base: LayoutId
  /** true once the user has rebound something after picking a layout */
  custom: boolean
  bindings: Bindings
}

interface ShortcutsPanelProps {
  open: boolean
  onClose: () => void
  state: ShortcutState
  lastImport: (ImportResult & { layoutId: LayoutId }) | null
  onImport: (layoutId: LayoutId) => void
  onRebind: (id: ActionId, combo: string | null) => ActionId | null
}

export function Kbd({ combo }: { combo: string | null }) {
  if (!combo) return <span className="kbd-empty">—</span>
  return (
    <span className="kbd-group">
      {formatCombo(combo).map((k, i) => (
        <kbd key={i}>{k}</kbd>
      ))}
    </span>
  )
}

export function ShortcutsPanel({ open, onClose, state, lastImport, onImport, onRebind }: ShortcutsPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [capturing, setCapturing] = useState<ActionId | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // <dialog> gives us a real modal: focus trap, Esc to close, backdrop
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const startCapture = (id: ActionId) => {
    setCapturing(id)
    setNotice(null)
  }

  const finishCapture = () => setCapturing(null)

  /** While capturing, the focused binding button receives the next key press. */
  const onCaptureKey = (id: ActionId, e: KeyboardEvent<HTMLButtonElement>) => {
    if (capturing !== id) return
    e.preventDefault()
    e.stopPropagation()

    if (e.code === 'Escape') return finishCapture()
    if (e.code === 'Backspace' || e.code === 'Delete') {
      onRebind(id, null)
      setNotice(`Cleared “${actionLabel(id)}”.`)
      return finishCapture()
    }

    const combo = eventToCombo(e.nativeEvent)
    if (!combo) return // bare modifier: wait for the actual key

    if (isReserved(combo)) {
      setNotice(`${formatCombo(combo).join(' ')} is reserved by the browser. Pick another key.`)
      return // stay in capture mode
    }

    const stolenFrom = onRebind(id, combo)
    setNotice(
      stolenFrom
        ? `${formatCombo(combo).join(' ')} moved from “${actionLabel(stolenFrom)}” to “${actionLabel(id)}”.`
        : `“${actionLabel(id)}” is now ${formatCombo(combo).join(' ')}.`,
    )
    finishCapture()
  }

  const changed = new Set(lastImport?.changed ?? [])
  const baseName = LAYOUTS.find((l) => l.id === state.base)?.name ?? ''

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts"
      aria-labelledby="shortcuts-title"
      onCancel={(e) => {
        e.preventDefault() // we decide what Esc does
        if (capturing) finishCapture()
        else onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose() // click on the backdrop
      }}
    >
      <div className="shortcuts-inner">
        <header className="shortcuts-head">
          <div>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <p className="muted">
              Layout: <strong>{state.custom ? `Custom (based on ${baseName})` : baseName}</strong>
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <section className="layout-picker" aria-label="Import a layout">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              className={`layout-card${state.base === l.id && !state.custom ? ' is-active' : ''}`}
              onClick={() => {
                onImport(l.id)
                setNotice(null)
                setCapturing(null)
              }}
            >
              <span className="layout-name">{l.id === 'default' ? 'Reset to defaults' : `Import ${l.name}`}</span>
              <span className="layout-desc">{l.description}</span>
            </button>
          ))}
        </section>

        <div className="shortcuts-status" role="status" aria-live="polite">
          {notice ??
            (lastImport && lastImport.layoutId !== 'default' ? (
              <>
                Imported {LAYOUTS.find((l) => l.id === lastImport.layoutId)?.name}: {lastImport.changed.length} shortcuts changed
                {lastImport.skipped.length > 0 && (
                  <>
                    {' '}· kept {lastImport.skipped.length} as-is because the browser reserves{' '}
                    {lastImport.skipped.map((s) => formatCombo(s.combo).join(' ')).join(', ')}
                  </>
                )}
              </>
            ) : (
              'Click any shortcut to change it.'
            ))}
        </div>

        <div className="shortcuts-list">
          {ACTION_GROUPS.map((group) => (
            <section key={group} className="shortcut-group">
              <h3>{group}</h3>
              {ACTIONS.filter((a) => a.group === group).map((a) => (
                <div key={a.id} className={`shortcut-row${changed.has(a.id) && !state.custom ? ' is-changed' : ''}`}>
                  <span className="shortcut-label">{a.label}</span>
                  <button
                    className={`binding${capturing === a.id ? ' is-capturing' : ''}`}
                    onClick={() => (capturing === a.id ? finishCapture() : startCapture(a.id))}
                    onKeyDown={(e) => onCaptureKey(a.id, e)}
                    onBlur={() => capturing === a.id && finishCapture()}
                    aria-label={`${a.label}: ${state.bindings[a.id] ? formatCombo(state.bindings[a.id]!).join(' ') : 'unassigned'}. Press to change.`}
                  >
                    {capturing === a.id ? <span className="capture-hint">Press keys… (Esc cancel · ⌫ clear)</span> : <Kbd combo={state.bindings[a.id]} />}
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
