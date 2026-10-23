import type { Grade } from '../types'

/**
 * Color grading as matrix math.
 * Each adjustment is a 5x5 affine matrix acting on [r, g, b, a, 1].
 * They are multiplied into ONE matrix and handed to an SVG feColorMatrix,
 * so the GPU applies the whole grade in a single pass per frame.
 */
type Matrix = number[][]

const identity = (): Matrix => [
  [1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1],
]

/** a · b  (b is applied first, then a) */
function multiply(a: Matrix, b: Matrix): Matrix {
  return a.map((row) =>
    b[0].map((_, j) => row.reduce((sum, v, k) => sum + v * b[k][j], 0)),
  )
}

/** Rec. 709 luma weights */
const LR = 0.2126
const LG = 0.7152
const LB = 0.0722

function brightness(value: number): Matrix {
  const m = identity()
  const offset = value / 200 // ±0.5 at the extremes
  m[0][4] = offset
  m[1][4] = offset
  m[2][4] = offset
  return m
}

function contrast(value: number): Matrix {
  const k = 1 + value / 100 // 0 … 2, pivots around mid-grey
  const m = identity()
  const offset = 0.5 * (1 - k)
  for (let i = 0; i < 3; i++) {
    m[i][i] = k
    m[i][4] = offset
  }
  return m
}

function saturation(value: number): Matrix {
  const s = 1 + value / 100 // 0 = greyscale, 2 = double
  const luma = [LR, LG, LB]
  const m = identity()
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      m[i][j] = luma[j] * (1 - s) + (i === j ? s : 0)
    }
  }
  return m
}

function warmth(value: number): Matrix {
  const t = value / 100
  const m = identity()
  m[0][0] = 1 + 0.12 * t // red up when warm
  m[1][1] = 1 + 0.02 * t
  m[2][2] = 1 - 0.12 * t // blue down when warm
  return m
}

/** Order: brightness → contrast → saturation → warmth */
export function gradeToMatrix(grade: Grade): string {
  const m = [warmth(grade.warmth), saturation(grade.saturation), contrast(grade.contrast), brightness(grade.brightness)].reduce(
    (acc, step) => multiply(acc, step),
    identity(),
  )
  // feColorMatrix wants the first 4 rows (20 numbers)
  return m
    .slice(0, 4)
    .flat()
    .map((n) => Number(n.toFixed(4)))
    .join(' ')
}

export function isNeutral(grade: Grade): boolean {
  return Object.values(grade).every((v) => v === 0)
}
