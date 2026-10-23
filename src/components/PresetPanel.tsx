import type { Grade } from '../types'
import { PRESETS, matchPreset } from '../lib/presets'
import { gradeToMatrix } from '../lib/colorMatrix'

interface PresetPanelProps {
  grade: Grade
  onApply: (target: Grade) => void
}

export function PresetPanel({ grade, onApply }: PresetPanelProps) {
  const active = matchPreset(grade)

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Presets</h2>
      </header>

      {/* One filter per preset, so each swatch previews its own look */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        {PRESETS.map((p) => (
          <filter key={p.id} id={`preset-${p.id}`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={gradeToMatrix(p.grade)} />
          </filter>
        ))}
      </svg>

      <div className="preset-grid">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`preset${active === p.id ? ' is-active' : ''}`}
            aria-pressed={active === p.id}
            onClick={() => onApply(p.grade)}
          >
            <span className="preset-swatch" style={{ filter: `url(#preset-${p.id})` }} />
            <span className="preset-name">{p.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
