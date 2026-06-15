import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Sparkles, FileText, ListChecks, ChevronRight, ChevronLeft, Loader } from 'lucide-react'
import api from '../api/client'

interface Message { role: 'user' | 'assistant'; content: string }

interface Props {
  recordingId: string | null
  summary?: string
  keyPoints?: string[]
  actionItems?: string[]
  isOpen: boolean
  onToggle: () => void
}

const SUGGESTIONS = [
  'Summarize the meeting',
  'List action items',
  'Who spoke the most?',
  'What were the key decisions?',
]

export default function AIChatPanel({ recordingId, summary, keyPoints, actionItems, isOpen, onToggle }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (summary && messages.length === 0) {
      setMessages([{ role: 'assistant', content: `📋 **Summary**\n\n${summary}` }])
    }
  }, [summary])

  useEffect(() => { setMessages([]); setInput('') }, [recordingId])

  const send = async (text: string) => {
    if (!text.trim() || !recordingId || loading) return
    setMessages((p) => [...p, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/chat', {
        recording_id: recordingId,
        question: text,
        history: messages.slice(-6),
      })
      setMessages((p) => [...p, { role: 'assistant', content: res.data.answer }])
    } catch (e: any) {
      setMessages((p) => [...p, { role: 'assistant', content: `⚠️ ${e.response?.data?.detail || 'Error'}` }])
    } finally {
      setLoading(false)
    }
  }

  /* ── Collapsed strip */
  if (!isOpen) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '.75rem',
        background: 'hsl(var(--card))',
        borderLeft: '2px solid hsl(var(--border) / .3)',
      }}>
        <button
          className="icon-btn"
          onClick={onToggle}
          title="Open AI Assistant"
          style={{ marginBottom: '10px' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'hsl(var(--accent) / .1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid hsl(var(--accent) / .25)',
        }}>
          <Bot size={16} style={{ color: 'hsl(var(--accent))', opacity: .7 }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'hsl(var(--card))',
      borderLeft: '2px solid hsl(var(--border) / .3)',
      overflow: 'hidden'
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '.8rem 1rem',
        borderBottom: '1.5px solid hsl(var(--border) / .3)',
        background: 'hsl(var(--card) / .9)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
        minHeight: '56px'
      }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
          background: 'hsl(var(--accent) / .12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid hsl(var(--accent) / .3)',
        }}>
          <Bot size={16} style={{ color: 'hsl(var(--accent))' }} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '.95rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))' }}>
            AI Assistant
          </span>
        </div>
        <button className="icon-btn" onClick={onToggle} title="Close panel" style={{ width: '28px', height: '28px' }}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Key points + action items */}
      {(keyPoints?.length || actionItems?.length) ? (
        <div
          className="key-points-section"
          style={{
            padding: '1rem',
            borderBottom: '1.5px solid hsl(var(--border) / .3)',
            display: 'flex', flexDirection: 'column', gap: '10px',
            maxHeight: '40vh', minHeight: '160px',
            overflowY: 'auto', overflowX: 'hidden',
            flexShrink: 0,
            background: 'hsl(var(--paper) / .3)',
          }}
        >
          {keyPoints && keyPoints.length > 0 && (
            <div className="animate-slide-up" style={{
              padding: '1rem',
              background: 'hsl(var(--card))',
              borderRadius: '10px',
              border: '1.5px solid hsl(130,60%,45% / .2)',
              borderLeft: '3px solid hsl(130,60%,45%)',
            }}>
              <div style={{
                fontSize: '.72rem', fontWeight: 700,
                color: 'hsl(130,60%,40%)',
                textTransform: 'uppercase', letterSpacing: '.08em',
                marginBottom: '10px',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: 'Inter, sans-serif'
              }}>
                <FileText size={12} /> Key Points
              </div>
              {keyPoints.map((k, i) => (
                <div key={i} style={{
                  fontSize: '.86rem', color: 'hsl(var(--ink-soft))',
                  marginBottom: '6px', paddingLeft: '1rem', position: 'relative',
                  lineHeight: 1.6, fontFamily: 'Inter, sans-serif',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'hsl(var(--accent))', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>•</span>
                  {k}
                </div>
              ))}
            </div>
          )}

          {actionItems && actionItems.length > 0 && (
            <div className="animate-slide-up" style={{
              padding: '1rem',
              background: 'hsl(var(--card))',
              borderRadius: '10px',
              border: '1.5px solid hsl(var(--accent) / .2)',
              borderLeft: '3px solid hsl(var(--accent))',
            }}>
              <div style={{
                fontSize: '.72rem', fontWeight: 700,
                color: 'hsl(var(--accent))',
                textTransform: 'uppercase', letterSpacing: '.08em',
                marginBottom: '10px',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: 'Inter, sans-serif'
              }}>
                <ListChecks size={12} /> Action Items
              </div>
              {actionItems.map((a, i) => (
                <div key={i} style={{
                  fontSize: '.86rem', color: 'hsl(var(--ink-soft))',
                  marginBottom: '6px', paddingLeft: '1.25rem', position: 'relative',
                  lineHeight: 1.6, fontFamily: 'Inter, sans-serif',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'hsl(var(--pencil))', fontWeight: 400, fontSize: '.9rem' }}>☐</span>
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Messages */}
      {messages.length > 0 ? (
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: '10px',
          minHeight: 0,
        }}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`chat-msg ${m.role} animate-slide-up`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s`, animationFillMode: 'both' }}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="chat-msg assistant animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader size={13} className="spin" /> Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }} />
      )}

      {/* Suggestions */}
      {messages.length === 0 && recordingId && (
        <div style={{
          padding: '.75rem 1rem',
          display: 'flex', flexWrap: 'wrap', gap: '6px',
          flexShrink: 0,
          background: 'hsl(var(--card))',
          borderTop: '1.5px solid hsl(var(--border) / .2)'
        }}>
          <p style={{ width: '100%', fontSize: '.72rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>
            Quick questions
          </p>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chat-suggestion" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '.75rem 1rem',
        borderTop: '1.5px solid hsl(var(--border) / .3)',
        display: 'flex', gap: '8px',
        flexShrink: 0,
        background: 'hsl(var(--card))'
      }}>
        <input
          className="input"
          placeholder={!recordingId ? 'Select a recording first…' : 'Ask anything…'}
          value={input}
          disabled={!recordingId || loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          style={{ flex: 1, fontSize: '.88rem', height: '38px', padding: '.5rem .85rem' }}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '.5rem .85rem', height: '38px', flexShrink: 0 }}
          disabled={!recordingId || loading || !input.trim()}
          onClick={() => send(input)}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
