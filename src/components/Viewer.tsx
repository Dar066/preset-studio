import { useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import { FRAME } from '../types'
import type { Grade, PlayerHandle } from '../types'
import { gradeToMatrix } from '../lib/colorMatrix'

interface ViewerProps {
  src: string
  grade: Grade
  /** true = show the original, ungraded frame (compare) */
  bypass: boolean
  /** lets keyboard shortcuts drive this player */
  ref?: Ref<PlayerHandle>
}

const FILTER_ID = 'ps-grade'

function formatTime(t: number): string {
  if (!Number.isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Viewer({ src, grade, bypass, ref }: ViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  const seek = (t: number) => {
    const v = videoRef.current
    if (!v) return
    const clamped = Math.min(Math.max(0, t), v.duration || 0)
    v.currentTime = clamped
    setTime(clamped)
  }

  // A single clip has two edit points: its start and its end
  useImperativeHandle(ref, () => ({
    togglePlay,
    play: () => void videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seekBy: (s) => seek((videoRef.current?.currentTime ?? 0) + s),
    seekTo: seek,
    stepFrames: (n) => {
      videoRef.current?.pause()
      seek((videoRef.current?.currentTime ?? 0) + n * FRAME)
    },
    prevEdit: () => seek(0),
    nextEdit: () => seek(Infinity),
  }))

  return (
    <div className="viewer">
      {/* The whole grade lives in this one matrix */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id={FILTER_ID} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={gradeToMatrix(grade)} />
        </filter>
      </svg>

      <div className="viewer-stage" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          playsInline
          muted
          loop
          style={{ filter: bypass ? 'none' : `url(#${FILTER_ID})` }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => setError(true)}
        />
        {bypass && <span className="viewer-badge">Original</span>}
        {error && <span className="viewer-error">Couldn't load this clip. Try another or open a local file.</span>}
      </div>

      <div className="transport">
        <button className="btn-icon" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z" /></svg>
          )}
        </button>
        <input
          className="scrub"
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Scrub"
        />
        <span className="timecode">
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
