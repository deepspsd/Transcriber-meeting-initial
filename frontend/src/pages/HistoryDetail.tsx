import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader, Clock, Users, FileAudio, FileText, Play, Pause } from 'lucide-react'
import TranscriptViewer from '../components/TranscriptViewer'
import AIChatPanel from '../components/AIChatPanel'
import PDFButton from '../components/PDFButton'
import InlineEdit from '../components/InlineEdit'
import api from '../api/client'

function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}m ${sec}s`
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

// Deterministic speaker color (same as History page)
const SPEAKER_COLORS = [
  { bg: 'hsl(14,90%,56%)', border: 'hsl(14,90%,56% / .3)', text: 'hsl(14,90%,30%)' },
  { bg: 'hsl(205,85%,55%)', border: 'hsl(205,85%,55% / .3)', text: 'hsl(205,85%,28%)' },
  { bg: 'hsl(130,60%,45%)', border: 'hsl(130,60%,45% / .3)', text: 'hsl(130,60%,25%)' },
  { bg: 'hsl(280,65%,58%)', border: 'hsl(280,65%,58% / .3)', text: 'hsl(280,65%,30%)' },
  { bg: 'hsl(45,90%,50%)', border: 'hsl(45,90%,50% / .3)', text: 'hsl(45,90%,25%)' },
  { bg: 'hsl(340,75%,58%)', border: 'hsl(340,75%,58% / .3)', text: 'hsl(340,75%,30%)' },
]
function getSpeakerColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return SPEAKER_COLORS[hash % SPEAKER_COLORS.length]
}

// ── Custom audio player ───────────────────────────────────────
function CustomAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const scrubRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => { setCurrentTime(audio.currentTime); setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) }
    const onDurationChange = () => setDuration(audio.duration)
    const onEnded = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  const handleScrubClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = scrubRef.current
    if (!audio || !bar || !audio.duration) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * audio.duration
  }, [])

  return (
    <div className="custom-audio-player">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="audio-play-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: '1px' }} />}
      </button>
      <div
        ref={scrubRef}
        className="audio-scrub"
        onClick={handleScrubClick}
        title="Click to seek"
      >
        <div className="audio-scrub-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="audio-time">
        {fmtTime(currentTime)} / {fmtTime(duration)}
      </span>
    </div>
  )
}

export default function HistoryDetail() {
  const { id } = useParams()
  const [rec, setRec] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleRename = async (newName: string) => {
    await api.patch(`/history/${id}/rename`, { filename: newName })
    setRec((prev: any) => ({ ...prev, filename: newName }))
  }

  useEffect(() => {
    if (!id) return
    api.get(`/history/${id}`).then((r) => setRec(r.data)).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id || !rec?.file_path) return
    let isActive = true
    let nextAudioUrl: string | null = null
    api.get(`/history/${id}/audio`, { responseType: 'blob' })
      .then((response) => {
        if (!isActive) return
        nextAudioUrl = URL.createObjectURL(response.data)
        setAudioUrl(nextAudioUrl)
      })
      .catch(() => { if (isActive) setAudioUrl(null) })
    return () => {
      isActive = false
      if (nextAudioUrl) URL.revokeObjectURL(nextAudioUrl)
    }
  }, [id, rec?.file_path])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1rem' }}>
      <Loader size={24} className="spin" style={{ color: 'hsl(var(--accent))' }} />
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '.9rem', color: 'hsl(var(--pencil))' }}>Loading recording…</p>
    </div>
  )

  if (!rec) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'hsl(var(--pencil))' }}>
      Recording not found.
    </div>
  )

  const chatW = chatOpen ? '340px' : '48px'
  const speakers: string[] = rec.speakers_detected || []

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `1fr ${chatW}`,
      minHeight: '100%', transition: 'grid-template-columns .25s ease'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Header */}
        <div className="panel-header">
          <button
            onClick={() => navigate('/dashboard/history')}
            className="icon-btn"
            title="Back to history"
            style={{ flexShrink: 0 }}
          >
            <ArrowLeft size={15} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: '1rem',
              overflow: 'hidden',
              fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))',
              marginBottom: '5px'
            }}>
              <InlineEdit
                value={rec.filename}
                onSave={handleRename}
                textStyle={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif' }}>
                <Clock size={11} /> {new Date(rec.created_at).toLocaleString()}
              </span>
              {rec.duration > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', fontWeight: 600, background: 'hsl(var(--muted))', color: 'hsl(var(--pencil))', border: '1px solid hsl(var(--ink) / .08)', padding: '.1rem .45rem', borderRadius: '999px', fontFamily: 'JetBrains Mono, monospace' }}>
                  <FileAudio size={10} /> {fmtDuration(rec.duration)}
                </span>
              )}
              {/* Speaker chips */}
              {speakers.map((sp, si) => {
                const col = getSpeakerColor(sp)
                return (
                  <span key={si} className="speaker-chip" style={{
                    background: `${col.bg}18`,
                    borderColor: `${col.bg}55`,
                    color: col.text,
                  }}>
                    <span className="speaker-chip-dot" style={{ background: col.bg }}>
                      {sp.charAt(0).toUpperCase()}
                    </span>
                    {sp}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Custom Audio player */}
          {audioUrl && <CustomAudioPlayer src={audioUrl} />}

          {/* Actions */}
          {rec?.status === 'done' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/dashboard/history/${id}/mom`)}
                style={{ height: '36px', fontSize: '.82rem', padding: '0 1rem', gap: '6px' }}
              >
                <FileText size={14} />
                <span>Minutes of Meeting</span>
              </button>
              <PDFButton
                recordingId={id}
                filename={rec.filename}
                variant="ghost"
              />
            </div>
          )}
        </div>

        {/* Transcript */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '1.25rem 1.5rem',
          background: 'hsl(var(--paper) / .4)',
          minHeight: 0
        }}>
          {rec.transcript?.length > 0 && (
            <div className="transcript-subheader">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'hsl(var(--ink))', fontFamily: 'Inter, sans-serif', letterSpacing: '-.01em', margin: 0 }}>
                  Transcript
                </h3>
                <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'hsl(var(--pencil))', background: 'hsl(var(--muted))', padding: '.15rem .5rem', borderRadius: '999px', fontFamily: 'Inter, sans-serif' }}>
                  {rec.transcript.length} segments
                </span>
                {speakers.length > 0 && (
                  <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif' }}>
                    · <Users size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {speakers.length} {speakers.length === 1 ? 'speaker' : 'speakers'}
                  </span>
                )}
              </div>
              <div className="confidence-legend">
                <span style={{ color: 'hsl(var(--pencil))', fontWeight: 600, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Confidence:</span>
                <span className="confidence-legend-item"><span className="conf-dot" style={{ background: 'hsl(var(--sticky-green))' }} />High</span>
                <span className="confidence-legend-item"><span className="conf-dot" style={{ background: 'hsl(45,90%,50%)' }} />Mid</span>
                <span className="confidence-legend-item"><span className="conf-dot" style={{ background: 'hsl(var(--destructive))' }} />Low</span>
              </div>
            </div>
          )}
          <TranscriptViewer segments={rec.transcript || []} />
        </div>
      </div>

      <AIChatPanel
        recordingId={id!}
        summary={rec.summary}
        keyPoints={rec.key_points}
        actionItems={rec.action_items}
        isOpen={chatOpen}
        onToggle={() => setChatOpen((o) => !o)}
      />
    </div>
  )
}
