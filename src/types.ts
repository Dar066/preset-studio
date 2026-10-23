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

export interface Clip {
  id: string
  name: string
  src: string
}
