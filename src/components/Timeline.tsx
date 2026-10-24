import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { SequenceLayout } from '../lib/transition'

interface TimelineProps {
  layout: SequenceLayout
  time: number
  labelA: string
  labelB: string
  onSeek: (t: number) => void
}

/** Two-track timeline (V1 / V2). Click or drag anywhere to scrub. */
export function Timeline({ layout, time, labelA, labelB, onSeek }: TimelineProps) {
  const { durA, durB, bStart, overlap, total } = layout
  const pct = (t: number) => (total > 0 ? (t / total) * 100 : 0)
  const overlayRef = useRef<HTMLDivElement>(null) // spans the lanes only, not the V1/V2 labels

  const seekFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width)
    onSeek((x / rect.width) * total)
  }

  return (
    <div
      className="timeline"
      role="slider"
      aria-label="Timeline"
      aria-valuemin={0}
      aria-valuemax={Number(total.toFixed(1))}
      aria-valuenow={Number(time.toFixed(1))}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFromPointer(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) seekFromPointer(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, time - 0.5))
        if (e.key === 'ArrowRight') onSeek(Math.min(total, time + 0.5))
      }}
    >
      <div className="track">
        <span className="track-label">V2</span>
        <div className="track-lane">
          <div className="track-clip clip-b" style={{ left: `${pct(bStart)}%`, width: `${pct(durB)}%` }}>
            {labelB}
          </div>
        </div>
      </div>
      <div className="track">
        <span className="track-label">V1</span>
        <div className="track-lane">
          <div className="track-clip clip-a" style={{ left: 0, width: `${pct(durA)}%` }}>
            {labelA}
          </div>
        </div>
      </div>

      <div className="timeline-overlay" ref={overlayRef}>
        {overlap > 0 && (
          <div className="track-overlap" style={{ left: `${pct(bStart)}%`, width: `${pct(overlap)}%` }}>
            <span>{overlap.toFixed(1)}s</span>
          </div>
        )}
        <div className="playhead" style={{ left: `${pct(time)}%` }} />
      </div>
    </div>
  )
}
