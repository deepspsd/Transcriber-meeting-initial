import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Sparkles, FileText, ListChecks, ChevronRight, ChevronLeft } from 'lucide-react'
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
          style={{ marginBottom: '8px' }}
        >
          <ChevronLeft size={16} />
        </button>
        <Bot size={18} style={{ color: 'var(--accent)', opacity: .5 }} />
      </div>
    )
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="panel-header">
        <Bot size={16} style={{ color: 'var(--accent)' }} />
        <h2>AI Assistant</h2>
        <button className="icon-btn" onClick={onToggle} title="Close panel">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Key points + action items */}
      {(keyPoints?.length || actionItems?.length) ? (
        <div style={{ padding: '.75rem', borderBottom: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          {keyPoints && keyPoints.length > 0 && (
            <div className="glass" style={{ padding: '.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FileText size={11} /> Key Points
              </div>
              {keyPoints.map((k, i) => <div key={i} style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>• {k}</div>)}
            </div>
          )}
          {actionItems && actionItems.length > 0 && (
            <div className="glass" style={{ padding: '.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ListChecks size={11} /> Action Items
              </div>
              {actionItems.map((a, i) => <div key={i} style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>☐ {a}</div>)}
            </div>
          )}
        </div>
      ) : null}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem', marginTop: '2rem' }}>
            <Sparkles size={28} style={{ margin: '0 auto .5rem', display: 'block', opacity: .4 }} />
            {!recordingId ? 'Record audio to start chatting.' : 'Ask anything about this conversation.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
        ))}
        {loading && <div className="chat-msg assistant"><span className="spin" style={{ display: 'inline-block' }}>⏳</span> Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && recordingId && (
        <div style={{ padding: '0 .75rem .5rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SUGGESTIONS.map((s) => <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '.75rem', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: '8px' }}>
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
          style={{ padding: '.5rem .75rem' }}
          disabled={!recordingId || loading || !input.trim()}
          onClick={() => send(input)}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
