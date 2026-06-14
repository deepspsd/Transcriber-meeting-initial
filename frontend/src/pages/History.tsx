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
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 340px', 
      height: '100%', 
      overflow: 'hidden' 
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        <div className="panel-header" style={{ flexShrink: 0 }}>
          <HistoryIcon size={20} style={{ color: 'hsl(var(--accent))' }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ marginBottom: '.25rem' }}>History</h1>
            <p style={{ 
              fontSize: '.88rem', 
              color: 'hsl(var(--pencil))',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400
            }}>
              View and manage your recordings
            </p>
          </div>
          <span className="badge badge-purple" style={{ fontSize: '.8rem', padding: '.25rem .7rem' }}>
            {items.length} {items.length === 1 ? 'recording' : 'recordings'}
          </span>
        </div>

        {/* SCROLLABLE LIST */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '1.5rem 1.75rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          background: 'hsl(var(--paper) / .5)',
          minHeight: 0 // Important for flex scrolling
        }}>
          {loading && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'hsl(var(--pencil))', 
              padding: '4rem',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <Loader size={28} className="spin" style={{ color: 'hsl(var(--accent))' }} />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '.9rem' }}>Loading recordings...</p>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 2rem', 
              color: 'hsl(var(--pencil))' 
            }}>
              <Mic 
                size={48} 
                style={{ 
                  margin: '0 auto 1.5rem', 
                  display: 'block', 
                  opacity: 0.3,
                  color: 'hsl(var(--accent))'
                }} 
                className="animate-float"
              />
              <p style={{ 
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: '.5rem',
                fontFamily: 'Inter, sans-serif'
              }}>
                No recordings yet
              </p>
              <p style={{ fontSize: '.88rem', opacity: .7 }}>
                Start by recording a conversation!
              </p>
            </div>
          )}

          {items.map((item, idx) => (
            <div
              key={item.id}
              className="card-hover animate-slide-up"
              onClick={() => navigate(`/dashboard/history/${item.id}`)}
              style={{ 
                padding: '1.1rem 1.3rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '14px',
                animationDelay: `${idx * 0.05}s`,
                animationFillMode: 'both'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap', 
                  marginBottom: '6px',
                  color: 'hsl(var(--ink))',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {item.filename}
                </div>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '12px', 
                  fontSize: '0.8rem', 
                  color: 'hsl(var(--pencil))',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={12} /> {fmtDate(item.created_at)}
                  </span>
                  {item.duration > 0 && <span>⏱ {fmtDuration(item.duration)}</span>}
                  {item.speakers_detected.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Users size={12} /> {item.speakers_detected.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`badge ${item.status === 'done' ? 'badge-green' : item.status === 'error' ? 'badge-red' : 'badge-yellow'}`}>
                  {item.status}
                </span>
                {item.has_summary && <span className="badge badge-purple">AI</span>}
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  disabled={deletingId === item.id}
                  className="icon-btn"
                  style={{ 
                    width: '32px',
                    height: '32px',
                    background: 'hsl(var(--card))'
                  }}
                >
                  {deletingId === item.id ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                </button>
                <ChevronRight size={16} style={{ color: 'hsl(var(--pencil))' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty right panel when no recording selected */}
      <div className="chat-panel" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'hsl(var(--card))'
      }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <HistoryIcon 
            size={40} 
            style={{ 
              margin: '0 auto 1rem', 
              display: 'block', 
              opacity: 0.2,
              color: 'hsl(var(--accent))'
            }}
            className="animate-float"
          />
          <p style={{ 
            color: 'hsl(var(--pencil))', 
            fontSize: '0.88rem', 
            fontFamily: 'Inter, sans-serif'
          }}>
            Click a recording to review it
          </p>
        </div>
      </div>
    </div>
  )
}
