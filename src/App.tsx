import { useRef, useState } from 'react'
import { NEUTRAL_GRADE } from './types'
import type { Clip, Grade, GradeKey } from './types'
import { Viewer } from './components/Viewer'
import { GradePanel } from './components/GradePanel'
import { PresetPanel } from './components/PresetPanel'
import { lerpGrade } from './lib/presets'

const TWEEN_MS = 280

// Blender Foundation open movies (CC BY), self-hosted in public/clips
const CLIPS: Clip[] = [
  { id: 'sintel', name: 'Sintel', src: '/clips/sintel.mp4' },
  { id: 'bunny', name: 'Big Buck Bunny', src: '/clips/bunny.mp4' },
]

export default function App() {
  const [clips, setClips] = useState<Clip[]>(CLIPS)
  const [clipId, setClipId] = useState(CLIPS[0].id)
  const [grade, setGrade] = useState<Grade>(NEUTRAL_GRADE)
  const [compare, setCompare] = useState(false)

  const clip = clips.find((c) => c.id === clipId) ?? clips[0]

  const tweenRef = useRef<number | null>(null)

  const stopTween = () => {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
    tweenRef.current = null
  }

  const updateGrade = (key: GradeKey, value: number) => {
    stopTween() // grabbing a slider cancels any running preset animation
    setGrade((g) => ({ ...g, [key]: value }))
  }

  // Glide the sliders to a preset instead of jumping, so you see the look being built
  const applyPreset = (target: Grade) => {
    stopTween()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGrade(target)
      return
    }
    const from = grade
    const start = performance.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS)
      const eased = 1 - (1 - t) ** 3 // ease-out cubic
      setGrade(lerpGrade(from, target, eased))
      tweenRef.current = t < 1 ? requestAnimationFrame(frame) : null
    }
    tweenRef.current = requestAnimationFrame(frame)
  }

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
          <button
            className={`btn-ghost${compare ? ' is-active' : ''}`}
            onPointerDown={() => setCompare(true)}
            onPointerUp={() => setCompare(false)}
            onPointerLeave={() => setCompare(false)}
            title="Hold to see the original"
          >
            Hold to compare
          </button>
        </div>
      </header>

      <main className="workspace">
        {/* key = fresh player state for every clip */}
        <Viewer key={clip.src} src={clip.src} grade={grade} bypass={compare} />
        <aside className="sidebar">
          <PresetPanel grade={grade} onApply={applyPreset} />
          <GradePanel grade={grade} onChange={updateGrade} onReset={() => applyPreset(NEUTRAL_GRADE)} />
        </aside>
      </main>

      <footer className="footer">
        Sample footage: Blender Foundation open movies, CC BY · Built by Muhammad Adnan Dar
      </footer>
    </div>
  )
}
