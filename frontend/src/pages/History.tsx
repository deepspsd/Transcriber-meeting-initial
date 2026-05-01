import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History as HistoryIcon, Clock, Users, Mic, Loader, Trash2, ChevronRight } from 'lucide-react'
import api from '../api/client'

interface HistoryItem {
  id: string
  filename: string
  duration: number
  status: string
  speakers_detected: string[]
  has_summary: boolean
  created_at: string
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}m ${sec}s`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/history')
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this recording?')) return
    setDeletingId(id)
    try {
      await api.delete(`/history/${id}`)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: '100dvh', overflow: 'hidden' }}>
      <div className="center-panel">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HistoryIcon size={18} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>History</h1>
          <span className="badge badge-purple">{items.length}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
              <Loader size={20} className="spin" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Mic size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
              No recordings yet. Start by recording a conversation!
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="glass fade-in"
              onClick={() => navigate(`/dashboard/history/${item.id}`)}
              style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                  {item.filename}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {fmtDate(item.created_at)}</span>
                  {item.duration > 0 && <span>⏱ {fmtDuration(item.duration)}</span>}
                  {item.speakers_detected.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={11} /> {item.speakers_detected.join(', ')}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${item.status === 'done' ? 'badge-green' : item.status === 'error' ? 'badge-red' : 'badge-yellow'}`}>
                  {item.status}
                </span>
                {item.has_summary && <span className="badge badge-purple">AI</span>}
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  disabled={deletingId === item.id}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                >
                  {deletingId === item.id ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                </button>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty right panel when no recording selected */}
      <div className="chat-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          Click a recording to review it.
        </p>
      </div>
    </div>
  )
}
