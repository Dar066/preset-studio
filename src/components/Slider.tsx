interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

/** Bipolar slider: fill grows out from the centre. Double-click resets to 0. */
export function Slider({ label, value, min, max, onChange }: SliderProps) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const zero = pct(0)
  const current = pct(value)
  const fillLeft = Math.min(zero, current)
  const fillWidth = Math.abs(current - zero)

  return (
    <label className="slider" onDoubleClick={() => onChange(0)} title="Double-click to reset">
      <span className="slider-head">
        <span className="slider-label">{label}</span>
        <span className={`slider-value${value !== 0 ? ' is-changed' : ''}`}>
          {value > 0 ? `+${value}` : value}
        </span>
      </span>
      <span className="slider-track">
        <span className="slider-fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} />
        <span className="slider-zero" style={{ left: `${zero}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </span>
    </label>
  )
}
