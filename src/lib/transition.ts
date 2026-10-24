import type { TransitionType } from '../types'

/**
 * Two clips on a timeline, overlapping by the transition duration:
 *
 *   A: [=========|////]
 *   B:           [////|==========]
 *                 ^ bStart        ^ total
 */
export interface SequenceLayout {
  durA: number
  durB: number
  /** transition length actually used (never longer than either clip) */
  overlap: number
  /** where clip B starts on the timeline */
  bStart: number
  total: number
}

export function sequenceLayout(durA: number, durB: number, transition: number): SequenceLayout {
  const overlap = Math.max(0, Math.min(transition, durA, durB))
  const bStart = durA - overlap
  return { durA, durB, overlap, bStart, total: bStart + durB }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** How visible each layer is at timeline time t. B is drawn on top of A. */
export function layerOpacity(t: number, layout: SequenceLayout, type: TransitionType): { a: number; b: number } {
  const { bStart, overlap } = layout
  if (overlap === 0) return t < bStart ? { a: 1, b: 0 } : { a: 0, b: 1 } // hard cut

  const p = clamp01((t - bStart) / overlap) // 0 → 1 across the transition

  if (type === 'crossfade') {
    // B fades in over a fully visible A: the result is A·(1-p) + B·p
    return { a: p < 1 ? 1 : 0, b: p }
  }
  // Dip to black: A fades out in the first half, B fades in during the second
  return { a: clamp01(1 - p * 2), b: clamp01(p * 2 - 1) }
}

export function formatTimecode(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const tenths = Math.floor((t * 10) % 10)
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`
}
