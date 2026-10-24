import { useEffect, useRef, useState } from 'react'
import { DEFAULT_TRANSITION, NEUTRAL_GRADE } from './types'
import { GRADE_CONTROLS } from './types'
import type { Clip, Grade, GradeKey, PlayerHandle, Transition } from './types'
import { Viewer } from './components/Viewer'
import { GradePanel } from './components/GradePanel'
import { PresetPanel } from './components/PresetPanel'
import { SequenceViewer } from './components/SequenceViewer'
import { TransitionPanel } from './components/TransitionPanel'
import { Kbd, ShortcutsPanel } from './components/ShortcutsPanel'
import type { ShortcutState } from './components/ShortcutsPanel'
import { PRESETS, lerpGrade, matchPreset } from './lib/presets'
import { emptyHistory, record, redo, undo } from './lib/history'
import type { History } from './lib/history'
import { ACTIONS, DEFAULT_BINDINGS, LAYOUTS, actionLabel, assign, formatCombo, importLayout } from './lib/shortcuts'
import type { ActionId, Bindings, ImportResult, LayoutId } from './lib/shortcuts'
import { useShortcuts } from './hooks/useShortcuts'
import type { ShortcutHandlers } from './hooks/useShortcuts'

const TWEEN_MS = 280

type Mode = 'clip' | 'sequence'

/** Everything undo/redo covers. View state (mode, playhead, clip) is deliberately not undoable, as in NLEs. */
interface Doc {
  grade: Grade
  transition: Transition
}

const sameGrade = (a: Grade, b: Grade) => GRADE_CONTROLS.every((c) => a[c.key] === b[c.key])

// Blender Foundation open movies (CC BY), self-hosted in public/clips
const CLIPS: Clip[] = [
  { id: 'sintel', name: 'Sintel', src: '/clips/sintel.mp4' },
  { id: 'bunny', name: 'Big Buck Bunny', src: '/clips/bunny.mp4' },
]

const SHORTCUTS_KEY = 'preset-studio:shortcuts:v1'

/** Restore the user's shortcut layout. Anything unreadable falls back to defaults. */
function loadShortcuts(): ShortcutState {
  const fallback: ShortcutState = { base: 'default', custom: false, bindings: DEFAULT_BINDINGS }
  try {
    const saved = JSON.parse(localStorage.getItem(SHORTCUTS_KEY) ?? 'null')
    if (!saved || !LAYOUTS.some((l) => l.id === saved.base)) return fallback
    const bindings: Bindings = { ...DEFAULT_BINDINGS }
    for (const a of ACTIONS) {
      const v = saved.bindings?.[a.id]
      if (typeof v === 'string' || v === null) bindings[a.id] = v
    }
    return { base: saved.base, custom: Boolean(saved.custom), bindings }
  } catch {
    return fallback // private mode, blocked storage, corrupted JSON …
  }
}

/** "Undo Brightness (Ctrl+Z)" */
function historyTitle(verb: string, label: string | undefined, combo: string | null): string {
  const keys = combo ? ` (${formatCombo(combo).join('+')})` : ''
  return label ? `${verb} ${label}${keys}` : `Nothing to ${verb.toLowerCase()}`
}

export default function App() {
  const [clips, setClips] = useState<Clip[]>(CLIPS)
  const [clipId, setClipId] = useState(CLIPS[0].id)
  const [grade, setGrade] = useState<Grade>(NEUTRAL_GRADE)
  const [compare, setCompare] = useState(false)
  const [mode, setMode] = useState<Mode>('clip')
  const [transition, setTransition] = useState<Transition>(DEFAULT_TRANSITION)
  const [shortcuts, setShortcuts] = useState<ShortcutState>(loadShortcuts)
  const [lastImport, setLastImport] = useState<(ImportResult & { layoutId: LayoutId }) | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [hint, setHint] = useState<{ id: ActionId; n: number; detail?: string } | null>(null)
  const [history, setHistory] = useState<History<Doc>>(emptyHistory)
  const playerRef = useRef<PlayerHandle>(null)
  const hintTimer = useRef<number | undefined>(undefined)

  const clip = clips.find((c) => c.id === clipId) ?? clips[0]

  const tweenRef = useRef<number | null>(null)
  const tweenTargetRef = useRef<Grade | null>(null)

  const stopTween = () => {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
    tweenRef.current = null
  }

  // ---------- Undo / redo ----------
  /** The document as the user intends it: a preset still animating counts as already applied. */
  const currentDoc = (): Doc => ({
    grade: tweenRef.current !== null && tweenTargetRef.current ? tweenTargetRef.current : grade,
    transition,
  })

  /** Save an undo point BEFORE a change. Same key + quick succession = same step (one slider drag). */
  const checkpoint = (label: string, key?: string) => setHistory(record(history, currentDoc(), label, key))

  const restore = (doc: Doc) => {
    stopTween()
    tweenTargetRef.current = null
    setGrade(doc.grade)
    setTransition(doc.transition)
  }

  const doUndo = (): string => {
    const step = undo(history, currentDoc())
    if (!step) return 'Nothing to undo'
    restore(step.doc)
    setHistory(step.history)
    return step.label
  }

  const doRedo = (): string => {
    const step = redo(history, currentDoc())
    if (!step) return 'Nothing to redo'
    restore(step.doc)
    setHistory(step.history)
    return step.label
  }

  const updateGrade = (key: GradeKey, value: number) => {
    if (grade[key] === value && tweenRef.current === null) return
    checkpoint(GRADE_CONTROLS.find((c) => c.key === key)?.label ?? key, `grade:${key}`)
    stopTween() // grabbing a slider cancels any running preset animation
    setGrade((g) => ({ ...g, [key]: value }))
  }

  // Glide the sliders to a preset instead of jumping, so you see the look being built
  const applyPreset = (target: Grade, label?: string) => {
    if (!sameGrade(currentDoc().grade, target)) {
      checkpoint(label ?? `${PRESETS.find((p) => p.id === matchPreset(target))?.name ?? 'Custom'} preset`)
    }
    stopTween()
    tweenTargetRef.current = target
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGrade(target)
      return
    }
    const from = grade
    let start: number | null = null // taken from the first animation frame
    const frame = (now: number) => {
      start ??= now
      const t = Math.min(1, (now - start) / TWEEN_MS)
      const eased = 1 - (1 - t) ** 3 // ease-out cubic
      setGrade(lerpGrade(from, target, eased))
      tweenRef.current = t < 1 ? requestAnimationFrame(frame) : null
    }
    tweenRef.current = requestAnimationFrame(frame)
  }

  const changeTransition = (next: Transition, label?: string) => {
    if (next.type === transition.type && next.duration === transition.duration) return
    if (label) checkpoint(label)
    else if (next.type !== transition.type) checkpoint(next.type === 'crossfade' ? 'Crossfade' : 'Dip to black')
    else checkpoint('Transition duration', 'transition:duration')
    setTransition(next)
  }

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    try {
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts))
    } catch {
      /* storage unavailable: shortcuts still work for this session */
    }
  }, [shortcuts])

  const importShortcuts = (layoutId: LayoutId) => {
    const result = importLayout(layoutId)
    setShortcuts({ base: layoutId, custom: false, bindings: result.bindings })
    setLastImport({ ...result, layoutId })
  }

  const rebindShortcut = (id: ActionId, combo: string | null): ActionId | null => {
    const { bindings, stolenFrom } = assign(shortcuts.bindings, id, combo)
    setShortcuts({ ...shortcuts, custom: true, bindings })
    return stolenFrom
  }

  /** Brief on-screen confirmation of what a key press did, like an NLE's HUD. */
  const showHint = (id: ActionId, detail?: string) => {
    window.clearTimeout(hintTimer.current)
    setHint((h) => ({ id, n: (h?.n ?? 0) + 1, detail }))
    hintTimer.current = window.setTimeout(() => setHint(null), 900)
  }

  const player = () => playerRef.current
  /** Each action may return a short detail for the on-screen hint (e.g. what was undone). */
  const actions: Record<ActionId, () => string | void> = {
    playPause: () => player()?.togglePlay(),
    pause: () => player()?.pause(),
    playForward: () => player()?.play(),
    rewind: () => player()?.seekBy(-1),
    forward: () => player()?.seekBy(1),
    stepBack: () => player()?.stepFrames(-1),
    stepForward: () => player()?.stepFrames(1),
    goStart: () => player()?.seekTo(0),
    goEnd: () => player()?.seekTo(Infinity),
    prevEdit: () => player()?.prevEdit(),
    nextEdit: () => player()?.nextEdit(),
    applyTransition: () => {
      setMode('sequence')
      changeTransition(DEFAULT_TRANSITION, 'Apply transition')
    },
    previewTransition: () => (mode === 'sequence' ? player()?.previewTransition?.() : setMode('sequence')),
    resetGrade: () => applyPreset(NEUTRAL_GRADE, 'Reset grade'),
    showClip: () => setMode('clip'),
    showSequence: () => setMode('sequence'),
    compareHold: () => setCompare(true),
    openShortcuts: () => setShortcutsOpen(true),
    undo: doUndo,
    redo: doRedo,
  }

  const handlers = Object.fromEntries(
    ACTIONS.map((a) => [
      a.id,
      {
        down: () => {
          const detail = actions[a.id]()
          if (a.id !== 'openShortcuts') showHint(a.id, detail || undefined)
        },
        up: a.id === 'compareHold' ? () => setCompare(false) : undefined,
      },
    ]),
  ) as ShortcutHandlers

  // Shortcuts pause while the panel is open, so pressing keys there only rebinds
  useShortcuts(shortcuts.bindings, handlers, !shortcutsOpen)

  // A local file never leaves the browser: it plays from an in-memory object URL
  const openLocalFile = (file: File) => {
    const local: Clip = { id: `local-${Date.now()}`, name: file.name, src: URL.createObjectURL(file) }
    setClips((cs) => [...cs, local])
    setClipId(local.id)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Preset Studio</span>
        </div>

        <div className="topbar-tools">
          <div className="history-btns">
            <button
              className="btn-square"
              onClick={() => showHint('undo', doUndo())}
              disabled={history.past.length === 0}
              aria-label="Undo"
              title={historyTitle('Undo', history.past.at(-1)?.label, shortcuts.bindings.undo)}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M5.5 3.5 2.5 6.5l3 3" /><path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7" /></svg>
            </button>
            <button
              className="btn-square"
              onClick={() => showHint('redo', doRedo())}
              disabled={history.future.length === 0}
              aria-label="Redo"
              title={historyTitle('Redo', history.future.at(-1)?.label, shortcuts.bindings.redo)}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="m10.5 3.5 3 3-3 3" /><path d="M13 6.5H6.5a3.5 3.5 0 0 0 0 7H9" /></svg>
            </button>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Mode">
            <button role="radio" aria-checked={mode === 'clip'} className={mode === 'clip' ? 'is-active' : ''} onClick={() => setMode('clip')}>
              Clip
            </button>
            <button role="radio" aria-checked={mode === 'sequence'} className={mode === 'sequence' ? 'is-active' : ''} onClick={() => setMode('sequence')}>
              Sequence
            </button>
          </div>
          {mode === 'clip' && (
            <>
              <select className="select" value={clip.id} onChange={(e) => setClipId(e.target.value)} aria-label="Clip">
                {clips.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label className="btn-ghost file-btn">
                Open file
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) openLocalFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </>
          )}
          <button
            className={`btn-ghost${compare ? ' is-active' : ''}`}
            onPointerDown={() => setCompare(true)}
            onPointerUp={() => setCompare(false)}
            onPointerLeave={() => setCompare(false)}
            title="Hold to see the original"
          >
            Hold to compare
          </button>
          <button className="btn-ghost shortcuts-btn" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts">
            Shortcuts <Kbd combo={shortcuts.bindings.openShortcuts} />
          </button>
        </div>
      </header>

      <main className="workspace">
        {mode === 'clip' ? (
          /* key = fresh player state for every clip */
          <Viewer key={clip.src} ref={playerRef} src={clip.src} grade={grade} bypass={compare} />
        ) : (
          <SequenceViewer ref={playerRef} clipA={CLIPS[0]} clipB={CLIPS[1]} transition={transition} grade={grade} bypass={compare} />
        )}
        <aside className="sidebar">
          {mode === 'sequence' && <TransitionPanel transition={transition} onChange={(t) => changeTransition(t)} />}
          <PresetPanel grade={grade} onApply={(g) => applyPreset(g)} />
          <GradePanel grade={grade} onChange={updateGrade} onReset={() => applyPreset(NEUTRAL_GRADE, 'Reset grade')} />
        </aside>

        {hint && (
          <div className="key-hint" key={hint.n} aria-hidden="true">
            <Kbd combo={shortcuts.bindings[hint.id]} />
            <span>
              {actionLabel(hint.id)}
              {hint.detail && <span className="key-hint-detail"> · {hint.detail}</span>}
            </span>
          </div>
        )}
      </main>

      <ShortcutsPanel
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        state={shortcuts}
        lastImport={lastImport}
        onImport={importShortcuts}
        onRebind={rebindShortcut}
      />

      <footer className="footer">
        Sample footage: Blender Foundation open movies, CC BY · Built by Muhammad Adnan Dar
      </footer>
    </div>
  )
}
