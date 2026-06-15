import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History as HistoryIcon, Clock, Users, Mic, Loader, Trash2, ChevronRight, Search } from 'lucide-react'
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
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}m ${sec}s`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  done: { bg: 'hsl(130,60%,45% / .12)', text: 'hsl(130,60%,38%)', border: 'hsl(130,60%,45% / .3)' },
  error: { bg: 'hsl(var(--destructive) / .1)', text: 'hsl(var(--destructive))', border: 'hsl(var(--destructive) / .3)' },
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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

  const filtered = query.trim()
    ? items.filter((i) =>
        i.filename.toLowerCase().includes(query.toLowerCase()) ||
        i.speakers_detected.some((s) => s.toLowerCase().includes(query.toLowerCase()))
      )
    : items

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div className="panel-header">
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
          background: 'hsl(var(--accent) / .12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid hsl(var(--accent) / .3)',
        }}>
          <HistoryIcon size={16} style={{ color: 'hsl(var(--accent))' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>History</h1>
          <p style={{ fontSize: '.82rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', fontWeight: 400, marginTop: '1px' }}>
            View and manage your recordings
          </p>
        </div>
        <span style={{
          fontSize: '.78rem', fontWeight: 600,
          color: 'hsl(var(--accent))',
          background: 'hsl(var(--accent) / .1)',
          padding: '.25rem .7rem',
          borderRadius: '999px',
          border: '1.5px solid hsl(var(--accent) / .25)',
          fontFamily: 'Inter, sans-serif',
          flexShrink: 0
        }}>
          {items.length} {items.length === 1 ? 'recording' : 'recordings'}
        </span>
      </div>

      {/* Search */}
      {items.length > 0 && (
        <div style={{ padding: '.75rem 1.5rem', borderBottom: '1px solid hsl(var(--border) / .4)', background: 'hsl(var(--card) / .5)', flexShrink: 0 }}>
          <div style={{ position: 'relative', maxWidth: '480px' }}>
            <Search size={14} style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'hsl(var(--pencil))', pointerEvents: 'none'
            }} />
            <input
              className="input"
              placeholder="Search recordings or speakers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: '2.2rem', fontSize: '.88rem', height: '36px', padding: '.45rem .9rem .45rem 2.2rem' }}
            />
          </div>
        </div>
      )}

      {/* List */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '1.25rem 1.5rem',
        display: 'flex', flexDirection: 'column', gap: '8px',
        background: 'hsl(var(--paper) / .4)',
        minHeight: 0
      }}>

        {loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'hsl(var(--pencil))', padding: '4rem',
            flexDirection: 'column', gap: '1rem'
          }}>
            <Loader size={28} className="spin" style={{ color: 'hsl(var(--accent))' }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '.9rem' }}>Loading recordings…</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'hsl(var(--pencil))' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'hsl(var(--accent) / .08)',
              border: '2px dashed hsl(var(--accent) / .25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <Mic size={32} style={{ opacity: 0.35, color: 'hsl(var(--accent))' }} className="animate-float" />
            </div>
            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '.5rem', fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))' }}>
              No recordings yet
            </p>
            <p style={{ fontSize: '.87rem', opacity: .7, fontFamily: 'Inter, sans-serif' }}>
              Start by recording a conversation!
            </p>
          </div>
        )}

        {!loading && items.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'hsl(var(--pencil))' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '.9rem' }}>No recordings match "{query}"</p>
          </div>
        )}

        {filtered.map((item, idx) => {
          const sc = STATUS_COLORS[item.status] ?? { bg: 'hsl(var(--accent) / .1)', text: 'hsl(var(--accent))', border: 'hsl(var(--accent) / .3)' }
          return (
            <div
              key={item.id}
              className="animate-slide-up"
              onClick={() => navigate(`/dashboard/history/${item.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '1rem 1.25rem',
                background: 'hsl(var(--card))',
                border: '1.5px solid hsl(var(--ink) / .1)',
                borderLeft: '4px solid hsl(var(--accent) / .4)',
                borderRadius: '0 10px 10px 0',
                cursor: 'pointer',
                transition: 'all .2s cubic-bezier(0.4,0,.2,1)',
                animationDelay: `${idx * 0.04}s`,
                animationFillMode: 'both',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'hsl(var(--accent))'
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateX(4px)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '2px 2px 0 0 hsl(var(--ink) / .06)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'hsl(var(--accent) / .4)'
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              {/* Icon */}
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'hsl(var(--accent) / .1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid hsl(var(--accent) / .2)',
                flexShrink: 0
              }}>
                <Mic size={16} style={{ color: 'hsl(var(--accent))' }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: '0.93rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: '5px', color: 'hsl(var(--ink))', fontFamily: 'Inter, sans-serif'
                }}>
                  {item.filename}
                </div>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '10px',
                  fontSize: '0.78rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> {fmtDate(item.created_at)}
                  </span>
                  {item.duration > 0 && (
                    <span>⏱ {fmtDuration(item.duration)}</span>
                  )}
                  {item.speakers_detected.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={11} /> {item.speakers_detected.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Right badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '.72rem', fontWeight: 600,
                  color: sc.text, background: sc.bg,
                  padding: '.15rem .55rem', borderRadius: '999px',
                  border: `1.5px solid ${sc.border}`,
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase', letterSpacing: '.04em'
                }}>
                  {item.status}
                </span>
                {item.has_summary && (
                  <span style={{
                    fontSize: '.72rem', fontWeight: 600,
                    color: 'hsl(235,80%,60%)',
                    background: 'hsl(235,80%,60% / .1)',
                    padding: '.15rem .55rem', borderRadius: '999px',
                    border: '1.5px solid hsl(235,80%,60% / .3)',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    AI
                  </span>
                )}
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  disabled={deletingId === item.id}
                  className="icon-btn"
                  style={{ width: '30px', height: '30px', color: 'hsl(var(--destructive))' }}
                >
                  {deletingId === item.id ? <Loader size={13} className="spin" /> : <Trash2 size={13} />}
                </button>
                <ChevronRight size={15} style={{ color: 'hsl(var(--pencil))' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
