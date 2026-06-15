import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader, Clock, Users, FileAudio } from 'lucide-react'
import TranscriptViewer from '../components/TranscriptViewer'
import AIChatPanel from '../components/AIChatPanel'
import api from '../api/client'

function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}m ${sec}s`
}

export default function HistoryDetail() {
  const { id } = useParams()
  const [rec, setRec] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const navigate = useNavigate()

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

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `1fr ${chatW}`,
      height: '100%', overflow: 'hidden', transition: 'grid-template-columns .25s ease'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

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
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))',
              marginBottom: '4px'
            }}>
              {rec.filename}
            </div>
            <div style={{
              display: 'flex', gap: '10px', flexWrap: 'wrap',
              fontSize: '0.77rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} /> {new Date(rec.created_at).toLocaleString()}
              </span>
              {rec.duration > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileAudio size={11} /> {fmtDuration(rec.duration)}
                </span>
              )}
              {rec.speakers_detected?.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={11} /> {rec.speakers_detected.join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Audio player */}
          {audioUrl && (
            <audio
              src={audioUrl}
              controls
              style={{
                height: 36, accentColor: 'hsl(var(--accent))',
                borderRadius: '8px', flexShrink: 0, minWidth: '180px', maxWidth: '260px'
              }}
            />
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
            <div style={{ marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'hsl(var(--ink))', fontFamily: 'Inter, sans-serif', letterSpacing: '-.01em' }}>
                Transcript
              </h3>
              <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'hsl(var(--pencil))', background: 'hsl(var(--muted))', padding: '.15rem .5rem', borderRadius: '999px', fontFamily: 'Inter, sans-serif' }}>
                {rec.transcript.length} segments
              </span>
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
