import { NEUTRAL_GRADE } from '../types'
import type { Grade, GradeKey, Preset } from '../types'

/** Presets are plain data: a name plus slider values. Adding a look = adding a line. */
export const PRESETS: Preset[] = [
  { id: 'none', name: 'None', grade: NEUTRAL_GRADE },
  { id: 'cinematic', name: 'Cinematic', grade: { brightness: -6, contrast: 28, saturation: -18, warmth: -22 } },
  { id: 'warm', name: 'Warm', grade: { brightness: 6, contrast: 8, saturation: 18, warmth: 48 } },
  { id: 'vintage', name: 'Vintage', grade: { brightness: 10, contrast: -28, saturation: -38, warmth: 36 } },
  { id: 'bw', name: 'B&W', grade: { brightness: 0, contrast: 22, saturation: -100, warmth: 0 } },
]

const KEYS = Object.keys(NEUTRAL_GRADE) as GradeKey[]

/** Which preset (if any) the current slider values exactly match. */
export function matchPreset(grade: Grade): string | null {
  const hit = PRESETS.find((p) => KEYS.every((k) => p.grade[k] === grade[k]))
  return hit ? hit.id : null
}

/** Blend two grades: t = 0 → from, t = 1 → to. Rounded so sliders stay whole numbers. */
export function lerpGrade(from: Grade, to: Grade, t: number): Grade {
  const out = { ...from }
  for (const k of KEYS) out[k] = Math.round(from[k] + (to[k] - from[k]) * t)
  return out
}
