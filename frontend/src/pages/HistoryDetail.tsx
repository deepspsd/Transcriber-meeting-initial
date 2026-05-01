import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader } from 'lucide-react'
import TranscriptViewer from '../components/TranscriptViewer'
import AIChatPanel from '../components/AIChatPanel'
import api from '../api/client'

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
      .catch(() => {
        if (isActive) setAudioUrl(null)
      })

    return () => {
      isActive = false
      if (nextAudioUrl) URL.revokeObjectURL(nextAudioUrl)
    }
  }, [id, rec?.file_path])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', gridColumn: 'span 2' }}>
      <Loader size={24} className="spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  if (!rec) return (
    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--text-muted)' }}>
      Recording not found.
    </div>
  )

  const chatW = chatOpen ? '340px' : '48px'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `1fr ${chatW}`, height: '100dvh', overflow: 'hidden', transition: 'grid-template-columns .25s ease' }}>
      <div className="center-panel">
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/dashboard/history')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '0.95rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.filename}</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(rec.created_at).toLocaleString()} {rec.duration ? `• ${Math.floor(rec.duration / 60)}m ${Math.floor(rec.duration % 60)}s` : ''}
            </p>
          </div>
          {audioUrl && <audio src={audioUrl} controls style={{ height: 36 }} />}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
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
