import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Sparkles, FileText, ListChecks, ChevronRight, ChevronLeft, Loader, Copy, Check } from 'lucide-react'
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
  'Key decisions made?',
]

// ── Minimal markdown parser ───────────────────────────────────
function parseMarkdown(text: string): string {
  return text
    // headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // unordered list items
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`)
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // paragraphs — split on double newlines
    .split(/\n{2,}/)
    .map(block => block.startsWith('<') ? block : `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className="md-content"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
    />
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={copy}
      title="Copy"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'hsl(var(--pencil))', padding: '3px 5px', borderRadius: '5px',
        display: 'flex', alignItems: 'center', gap: '4px',
        fontSize: '.68rem', fontFamily: 'Inter, sans-serif',
        transition: 'all .2s',
        opacity: 0.55,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.opacity = '1'
        el.style.background = 'hsl(var(--muted))'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.opacity = '0.55'
        el.style.background = 'none'
      }}
    >
      <span style={{
        display: 'inline-block',
        transition: 'transform .2s',
        transform: copied ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {copied ? <Check size={11} style={{ color: 'hsl(var(--success))' }} /> : <Copy size={11} />}
      </span>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function AIChatPanel({ recordingId, summary, keyPoints, actionItems, isOpen, onToggle }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (summary && messages.length === 0) {
      setMessages([{ role: 'assistant', content: `**Summary**\n\n${summary}` }])
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
      setMessages((p) => [...p, { role: 'assistant', content: `⚠️ ${e.response?.data?.detail || 'Error occurred'}` }])
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
        borderLeft: '1.5px solid hsl(var(--border) / .2)',
      }}>
        <button
          className="icon-btn"
          onClick={onToggle}
          title="Open AI Assistant"
          style={{ marginBottom: '12px' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px',
          background: 'linear-gradient(135deg, hsl(var(--accent) / .15), hsl(var(--accent) / .05))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid hsl(var(--accent) / .3)',
          boxShadow: '0 0 12px hsl(var(--accent) / .1)',
        }}>
          <Bot size={17} style={{ color: 'hsl(var(--accent))' }} />
        </div>
        {messages.length > 0 && (
          <div style={{
            marginTop: '10px',
            width: '8px', height: '8px',
            borderRadius: '50%',
            background: 'hsl(var(--success))',
            boxShadow: '0 0 8px hsl(var(--success) / .6)',
          }} className="animate-pulse-rec" />
        )}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'hsl(var(--card))',
      borderLeft: '1.5px solid hsl(var(--border) / .2)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '.9rem 1rem',
        borderBottom: '1.5px solid hsl(var(--border) / .2)',
        background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card) / .9) 100%)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
        minHeight: '58px',
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
          background: 'linear-gradient(135deg, hsl(var(--accent) / .18), hsl(var(--accent) / .06))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid hsl(var(--accent) / .35)',
          boxShadow: '0 0 14px hsl(var(--accent) / .12)',
        }}>
          <Bot size={16} style={{ color: 'hsl(var(--accent))' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.92rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))', lineHeight: 1.2 }}>
            AI Assistant
          </div>
          <div style={{ fontSize: '.68rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: recordingId ? 'hsl(var(--success))' : 'hsl(var(--pencil))', display: 'inline-block', boxShadow: recordingId ? '0 0 5px hsl(var(--success) / .6)' : 'none', transition: 'all .3s' }} />
            {recordingId ? 'Ready to chat' : 'No recording selected'}
          </div>
        </div>
        <button className="icon-btn" onClick={onToggle} title="Close panel" style={{ width: '30px', height: '30px', flexShrink: 0 }}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Key points + action items */}
      {(keyPoints?.length || actionItems?.length) ? (
        <div
          className="key-points-section"
          style={{
            padding: '.9rem',
            borderBottom: '1.5px solid hsl(var(--border) / .2)',
            display: 'flex', flexDirection: 'column', gap: '8px',
            maxHeight: '38vh', minHeight: '120px',
            overflowY: 'auto', overflowX: 'hidden',
            flexShrink: 0,
            background: 'hsl(var(--paper) / .3)',
          }}
        >
          {keyPoints && keyPoints.length > 0 && (
            <div className="animate-slide-up" style={{
              padding: '.9rem 1rem',
              background: 'hsl(var(--card))',
              borderRadius: '10px',
              border: '1px solid hsl(var(--success) / .2)',
              borderLeft: '3px solid hsl(var(--success))',
            }}>
              <div style={{
                fontSize: '.68rem', fontWeight: 700,
                color: 'hsl(var(--success))',
                textTransform: 'uppercase', letterSpacing: '.09em',
                marginBottom: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: 'Inter, sans-serif',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FileText size={11} /> Key Points
                </span>
                <span style={{ background: 'hsl(var(--success) / .1)', padding: '.08rem .4rem', borderRadius: '999px', fontSize: '.62rem' }}>
                  {keyPoints.length}
                </span>
              </div>
              {keyPoints.map((k, i) => (
                <div key={i} style={{
                  fontSize: '.83rem', color: 'hsl(var(--ink-soft))',
                  marginBottom: '5px', paddingLeft: '.9rem', position: 'relative',
                  lineHeight: 1.65, fontFamily: 'Inter, sans-serif',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'hsl(var(--success))', fontWeight: 700 }}>•</span>
                  {k}
                </div>
              ))}
            </div>
          )}

          {actionItems && actionItems.length > 0 && (
            <div className="animate-slide-up" style={{
              padding: '.9rem 1rem',
              background: 'hsl(var(--card))',
              borderRadius: '10px',
              border: '1px solid hsl(var(--accent) / .2)',
              borderLeft: '3px solid hsl(var(--accent))',
            }}>
              <div style={{
                fontSize: '.68rem', fontWeight: 700,
                color: 'hsl(var(--accent))',
                textTransform: 'uppercase', letterSpacing: '.09em',
                marginBottom: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: 'Inter, sans-serif',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ListChecks size={11} /> Action Items
                </span>
                <span style={{ background: 'hsl(var(--accent) / .1)', padding: '.08rem .4rem', borderRadius: '999px', fontSize: '.62rem' }}>
                  {actionItems.length}
                </span>
              </div>
              {actionItems.map((a, i) => (
                <div key={i} style={{
                  fontSize: '.83rem', color: 'hsl(var(--ink-soft))',
                  marginBottom: '5px', paddingLeft: '1.25rem', position: 'relative',
                  lineHeight: 1.65, fontFamily: 'Inter, sans-serif',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'hsl(var(--pencil))', fontSize: '.9rem' }}>☐</span>
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
          padding: '.9rem',
          display: 'flex', flexDirection: 'column', gap: '8px',
          minHeight: 0,
        }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              <div
                className={`chat-msg ${m.role} animate-scale-in`}
                style={{
                  animationDelay: `${Math.min(i * 0.04, 0.3)}s`,
                  animationFillMode: 'both',
                  ...(m.role === 'assistant' ? { borderLeft: '2px solid hsl(var(--accent) / .3)' } : {}),
                }}
              >
                <MarkdownContent content={m.content} />
              </div>
              {m.role === 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', paddingLeft: '2px' }}>
                  <CopyButton text={m.content} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="chat-msg assistant animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '.65rem .9rem' }}>
              <span className="typing-dot" style={{ width: '9px', height: '9px' }} />
              <span className="typing-dot" style={{ width: '9px', height: '9px', animationDelay: '.18s' }} />
              <span className="typing-dot" style={{ width: '9px', height: '9px', animationDelay: '.36s' }} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '14px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, hsl(var(--accent) / .12), hsl(var(--accent) / .04))',
            border: '1.5px solid hsl(var(--accent) / .25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px hsl(var(--accent) / .08)',
          }}>
            <Sparkles size={24} style={{ color: 'hsl(var(--accent))' }} className="animate-float" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '.88rem', color: 'hsl(var(--ink))', fontWeight: 600, marginBottom: '.3rem' }}>
              {recordingId ? 'Ask me anything' : 'AI Assistant'}
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '.78rem', color: 'hsl(var(--pencil))', lineHeight: 1.5, maxWidth: '180px', margin: '0 auto' }}>
              {recordingId ? 'About this recording — summaries, speakers, decisions…' : 'Process a recording to start chatting'}
            </p>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {messages.length === 0 && recordingId && (
        <div style={{
          padding: '.65rem .9rem',
          display: 'flex', flexWrap: 'wrap', gap: '5px',
          flexShrink: 0,
          background: 'hsl(var(--card))',
          borderTop: '1px solid hsl(var(--border) / .15)',
        }}>
          <p style={{ width: '100%', fontSize: '.68rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '3px' }}>
            Quick questions
          </p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="chat-suggestion"
              onClick={() => send(s)}
              style={{ transition: 'transform .18s, box-shadow .18s' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.transform = 'scale(1.04)'
                el.style.boxShadow = '0 2px 8px hsl(var(--accent) / .18)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.transform = 'scale(1)'
                el.style.boxShadow = 'none'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '.7rem .9rem',
        borderTop: '1.5px solid hsl(var(--border) / .2)',
        display: 'flex', gap: '7px',
        flexShrink: 0,
        background: 'hsl(var(--card))',
      }}>
        <input
          ref={inputRef}
          className="input"
          placeholder={!recordingId ? 'Select a recording first…' : 'Ask anything…'}
          value={input}
          disabled={!recordingId || loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          style={{ flex: 1, fontSize: '.875rem', height: '38px', padding: '.45rem .85rem' }}
        />
        <button
          className="btn btn-primary"
          style={{
            padding: '.45rem .85rem', height: '38px', flexShrink: 0, minWidth: '38px',
            transition: 'transform .15s',
          }}
          disabled={!recordingId || loading || !input.trim()}
          onClick={() => {
            const btn = document.activeElement as HTMLButtonElement
            btn?.blur()
            send(input)
          }}
          title="Send"
          onMouseDown={e => (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(2px)'}
          onMouseUp={e => (e.currentTarget as HTMLButtonElement).style.transform = 'none'}
        >
          {loading ? <Loader size={14} className="spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}
