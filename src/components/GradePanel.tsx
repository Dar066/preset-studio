import { GRADE_CONTROLS } from '../types'
import type { Grade, GradeKey } from '../types'
import { isNeutral } from '../lib/colorMatrix'
import { Slider } from './Slider'

interface GradePanelProps {
  grade: Grade
  onChange: (key: GradeKey, value: number) => void
  onReset: () => void
}

export function GradePanel({ grade, onChange, onReset }: GradePanelProps) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Color</h2>
        <button className="btn-ghost" onClick={onReset} disabled={isNeutral(grade)}>
          Reset all
        </button>
      </header>
      <div className="panel-body">
        {GRADE_CONTROLS.map((c) => (
          <Slider
            key={c.key}
            label={c.label}
            min={c.min}
            max={c.max}
            value={grade[c.key]}
            onChange={(v) => onChange(c.key, v)}
          />
        ))}
      </div>
    </section>
  )
}
