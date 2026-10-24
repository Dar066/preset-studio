import { useEffect, useMemo, useRef, useState } from 'react'
import type { Clip, Grade, Transition } from '../types'
import { gradeToMatrix } from '../lib/colorMatrix'
import { formatTimecode, layerOpacity, sequenceLayout } from '../lib/transition'
import type { SequenceLayout } from '../lib/transition'
import { Timeline } from './Timeline'

interface SequenceViewerProps {
  clipA: Clip
  clipB: Clip
  transition: Transition
  grade: Grade
  bypass: boolean
}

const FILTER_ID = 'ps-grade-seq'
const PREROLL = 1.5 // seconds shown before the transition when previewing it

/**
 * Plays two clips as one sequence. A master clock (requestAnimationFrame) owns
 * timeline time; both <video> elements are kept in sync with it, and their
 * opacities come from the transition math in lib/transition.ts.
 */
export function SequenceViewer({ clipA, clipB, transition, grade, bypass }: SequenceViewerProps) {
  const aRef = useRef<HTMLVideoElement>(null)
  const bRef = useRef<HTMLVideoElement>(null)
  const [durA, setDurA] = useState(0)
  const [durB, setDurB] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const layout = useMemo(() => sequenceLayout(durA, durB, transition.duration), [durA, durB, transition.duration])
  const ready = durA > 0 && durB > 0
  const shownTime = Math.min(time, layout.total)
  const opacity = layerOpacity(shownTime, layout, transition.type)

  // Refs give the animation loop the latest values without restarting it
  const timeRef = useRef(0)
  const layoutRef = useRef<SequenceLayout>(layout)
  const rafRef = useRef<number | null>(null)
  const clockRef = useRef({ startTime: 0, startPerf: 0 })

  /** Put each video at the right frame for timeline time t, playing or paused. */
  const syncVideos = (t: number, isPlaying: boolean) => {
    const { durA: dA, durB: dB, bStart } = layoutRef.current
    const sync = (v: HTMLVideoElement | null, local: number, dur: number) => {
      if (!v) return
      const active = local >= 0 && local < dur
      const target = Math.min(Math.max(0, local), Math.max(0, dur - 0.05))
      // While playing, only correct real drift; while paused, land on the exact frame
      const tolerance = isPlaying && active ? 0.25 : 0.04
      if (Math.abs(v.currentTime - target) > tolerance) v.currentTime = target
      if (isPlaying && active) {
        if (v.paused) void v.play()
      } else if (!v.paused) {
        v.pause()
      }
    }
    sync(aRef.current, t, dA)
    sync(bRef.current, t - bStart, dB)
  }

  const stopClock = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const tick = (now: number) => {
    const { startTime, startPerf } = clockRef.current
    const total = layoutRef.current.total
    const t = Math.min(total, startTime + (now - startPerf) / 1000)
    timeRef.current = t
    setTime(t)
    if (t >= total) {
      stopClock()
      setPlaying(false)
      syncVideos(t, false)
      return
    }
    syncVideos(t, true)
    rafRef.current = requestAnimationFrame(tick)
  }

  const play = (from = timeRef.current) => {
    if (!ready) return
    const start = from >= layoutRef.current.total ? 0 : from // at the end → restart
    stopClock()
    timeRef.current = start
    setTime(start)
    clockRef.current = { startTime: start, startPerf: performance.now() }
    setPlaying(true)
    syncVideos(start, true)
    rafRef.current = requestAnimationFrame(tick)
  }

  const pause = () => {
    stopClock()
    setPlaying(false)
    syncVideos(timeRef.current, false)
  }

  const seek = (t: number) => {
    const clamped = Math.min(Math.max(0, t), layoutRef.current.total)
    timeRef.current = clamped
    setTime(clamped)
    if (playing) {
      clockRef.current = { startTime: clamped, startPerf: performance.now() }
      syncVideos(clamped, true)
    } else {
      syncVideos(clamped, false)
    }
  }

  const previewTransition = () => play(Math.max(0, layout.bStart - PREROLL))

  // Transition length changed → keep the clock's view of the timeline current
  // and re-show the right frames if paused
  useEffect(() => {
    layoutRef.current = layout
    if (rafRef.current === null) {
      timeRef.current = Math.min(timeRef.current, layout.total)
      syncVideos(timeRef.current, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout])

  useEffect(() => stopClock, [])

  return (
    <div className="viewer viewer-seq">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id={FILTER_ID} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={gradeToMatrix(grade)} />
        </filter>
      </svg>

      <div className="viewer-stage" onClick={() => (playing ? pause() : play())}>
        {/* The grade is applied once to the composited layers, like an adjustment layer */}
        <div className="layers" style={{ filter: bypass ? 'none' : `url(#${FILTER_ID})` }}>
          <video
            ref={aRef}
            src={clipA.src}
            preload="auto"
            playsInline
            muted
            style={{ opacity: opacity.a }}
            onLoadedMetadata={(e) => setDurA(e.currentTarget.duration)}
          />
          <video
            ref={bRef}
            src={clipB.src}
            preload="auto"
            playsInline
            muted
            style={{ opacity: opacity.b }}
            onLoadedMetadata={(e) => setDurB(e.currentTarget.duration)}
          />
        </div>
        {bypass && <span className="viewer-badge">Original</span>}
        {!ready && <span className="viewer-badge viewer-badge-right">Loading clips…</span>}
      </div>

      <div className="transport">
        <button className="btn-icon" onClick={() => (playing ? pause() : play())} aria-label={playing ? 'Pause' : 'Play'} disabled={!ready}>
          {playing ? (
            <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z" /></svg>
          )}
        </button>
        <button className="btn-ghost" onClick={previewTransition} disabled={!ready} title={`Play from ${PREROLL}s before the transition`}>
          Preview transition
        </button>
        <span className="timecode">
          {formatTimecode(shownTime)} / {formatTimecode(layout.total)}
        </span>
      </div>

      <Timeline layout={layout} time={shownTime} labelA={clipA.name} labelB={clipB.name} onSeek={seek} />
    </div>
  )
}
