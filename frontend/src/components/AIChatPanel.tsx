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

  // Reset chat when recording changes
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

  /* ── Collapsed strip ───────────────────────────────── */
  if (!isOpen) {
    return (
      <div className="chat-panel-slim">
        <button
          className="icon-btn"
          onClick={onToggle}
          title="Open AI Assistant"
          style={{ marginBottom: '10px' }}
        >
          <ChevronLeft size={18} />
        </button>
        <Bot size={20} style={{ color: 'hsl(var(--accent))', opacity: .5 }} />
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'hsl(var(--card))',
      borderLeft: '2.5px dashed hsl(var(--border))',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div className="panel-header" style={{ flexShrink: 0 }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'hsl(var(--accent) / .15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid hsl(var(--accent) / .3)',
          flexShrink: 0
        }}>
          <Bot size={18} style={{ color: 'hsl(var(--accent))' }} />
        </div>
        <h2 style={{ 
          flex: 1,
          fontSize: '1.1rem',
          fontFamily: 'Caveat, cursive'
        }}>
          AI Assistant
        </h2>
        <button className="icon-btn" onClick={onToggle} title="Close panel">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Key points + action items - ALWAYS VISIBLE AND SCROLLABLE */}
      {(keyPoints?.length || actionItems?.length) ? (
        <div 
          className="key-points-section"
          style={{ 
            padding: '1.25rem',
            borderBottom: '2px dashed hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '40vh',
            minHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flexShrink: 0,
            background: 'hsl(var(--paper) / .3)',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {keyPoints && keyPoints.length > 0 && (
            <div className="glass animate-slide-up" style={{ 
              padding: '1.25rem',
              borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px',
              animationDelay: '0.1s',
              animationFillMode: 'both'
            }}>
              <div style={{ 
                fontSize: '.85rem',
                fontWeight: 700,
                color: 'hsl(var(--sticky-green))',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontFamily: 'Inter, sans-serif'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'hsl(var(--sticky-green) / .3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid hsl(var(--sticky-green) / .5)'
                }}>
                  <FileText size={13} />
                </div>
                Key Points
              </div>
              {keyPoints.map((k, i) => (
                <div 
                  key={i}
                  className="animate-slide-up"
                  style={{ 
                    fontSize: '.88rem',
                    color: 'hsl(var(--ink-soft))',
                    marginBottom: '8px',
                    paddingLeft: '1.25rem',
                    position: 'relative',
                    lineHeight: 1.65,
                    fontFamily: 'Inter, sans-serif',
                    animationDelay: `${0.15 + i * 0.05}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: 'hsl(var(--accent))',
                    fontWeight: 700,
                    fontSize: '1.1rem'
                  }}>
                    •
                  </span>
                  {k}
                </div>
              ))}
            </div>
          )}
          {actionItems && actionItems.length > 0 && (
            <div className="glass animate-slide-up" style={{ 
              padding: '1.25rem',
              borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px',
              animationDelay: keyPoints?.length ? '0.2s' : '0.1s',
              animationFillMode: 'both'
            }}>
              <div style={{ 
                fontSize: '.85rem',
                fontWeight: 700,
                color: 'hsl(var(--accent))',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontFamily: 'Inter, sans-serif'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'hsl(var(--accent) / .15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid hsl(var(--accent) / .3)'
                }}>
                  <ListChecks size={13} />
                </div>
                Action Items
              </div>
              {actionItems.map((a, i) => (
                <div 
                  key={i}
                  className="animate-slide-up"
                  style={{ 
                    fontSize: '.88rem',
                    color: 'hsl(var(--ink-soft))',
                    marginBottom: '8px',
                    paddingLeft: '1.5rem',
                    position: 'relative',
                    lineHeight: 1.65,
                    fontFamily: 'Inter, sans-serif',
                    animationDelay: `${0.25 + i * 0.05}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: 'hsl(var(--accent))',
                    fontWeight: 600,
                    fontSize: '1rem'
                  }}>
                    ☐
                  </span>
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Messages - SCROLLABLE, ONLY SHOWN IF THERE ARE MESSAGES */}
      {messages.length > 0 && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: 0,
          borderBottom: '2px dashed hsl(var(--border))'
        }}>
          {messages.map((m, i) => (
            <div 
              key={i} 
              className={`chat-msg ${m.role} animate-slide-up`}
              style={{
                animationDelay: `${i * 0.05}s`,
                animationFillMode: 'both'
              }}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="chat-msg assistant animate-fade-in">
              <Loader size={14} className="spin" style={{ display: 'inline-block', marginRight: '6px' }} />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Spacer when no messages - pushes suggestions to bottom */}
      {messages.length === 0 && <div style={{ flex: 1, minHeight: 0 }} />}

      {/* Suggestions */}
      {messages.length === 0 && recordingId && (
        <div style={{ 
          padding: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          flexShrink: 0,
          background: 'hsl(var(--card))'
        }}>
          {SUGGESTIONS.map((s) => (
            <button 
              key={s} 
              className="chat-suggestion" 
              onClick={() => send(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input - FIXED AT BOTTOM */}
      <div style={{ 
        padding: '1rem',
        borderTop: '2px dashed hsl(var(--border))',
        display: 'flex',
        gap: '10px',
        flexShrink: 0,
        background: 'hsl(var(--card))'
      }}>
        <input
          className="input"
          placeholder={!recordingId ? 'Select a recording first…' : 'Ask something…'}
          value={input}
          disabled={!recordingId || loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '.65rem .85rem' }}
          disabled={!recordingId || loading || !input.trim()}
          onClick={() => send(input)}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
