export type GradeKey = 'brightness' | 'contrast' | 'saturation' | 'warmth'

/** A color grade: every value runs from -100 to 100, 0 = untouched. */
export type Grade = Record<GradeKey, number>

export const NEUTRAL_GRADE: Grade = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
}

export interface GradeControl {
  key: GradeKey
  label: string
  min: number
  max: number
}

export const GRADE_CONTROLS: GradeControl[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
]

export interface Preset {
  id: string
  name: string
  grade: Grade
}

export type TransitionType = 'crossfade' | 'dip'

export interface Transition {
  type: TransitionType
  /** seconds; 0 = hard cut */
  duration: number
}

export const DEFAULT_TRANSITION: Transition = { type: 'crossfade', duration: 1 }

/** What the keyboard shortcuts can ask either player to do. */
export interface PlayerHandle {
  togglePlay: () => void
  play: () => void
  pause: () => void
  seekBy: (seconds: number) => void
  seekTo: (seconds: number) => void
  stepFrames: (frames: number) => void
  prevEdit: () => void
  nextEdit: () => void
  /** sequence player only */
  previewTransition?: () => void
}

export const FRAME = 1 / 24 // seconds per frame for frame stepping

export interface Clip {
  id: string
  name: string
  src: string
}
