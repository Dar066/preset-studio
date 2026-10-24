import type { Transition, TransitionType } from '../types'

interface TransitionPanelProps {
  transition: Transition
  onChange: (next: Transition) => void
}

const TYPES: { id: TransitionType; label: string }[] = [
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'dip', label: 'Dip to black' },
]

const MAX_SECONDS = 3

export function TransitionPanel({ transition, onChange }: TransitionPanelProps) {
  const { type, duration } = transition
  const fill = (duration / MAX_SECONDS) * 100

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Transition</h2>
      </header>
      <div className="panel-body">
        <div className="segmented" role="radiogroup" aria-label="Transition type">
          {TYPES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={type === t.id}
              className={type === t.id ? 'is-active' : ''}
              onClick={() => onChange({ ...transition, type: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="slider" onDoubleClick={() => onChange({ ...transition, duration: 1 })} title="Double-click for 1.0s">
          <span className="slider-head">
            <span className="slider-label">Duration</span>
            <span className="slider-value is-changed">{duration === 0 ? 'Cut' : `${duration.toFixed(1)}s`}</span>
          </span>
          <span className="slider-track">
            <span className="slider-fill" style={{ left: 0, width: `${fill}%` }} />
            <input
              type="range"
              min={0}
              max={MAX_SECONDS}
              step={0.1}
              value={duration}
              aria-label="Transition duration"
              onChange={(e) => onChange({ ...transition, duration: Number(e.target.value) })}
            />
          </span>
        </label>
      </div>
    </section>
  )
}
