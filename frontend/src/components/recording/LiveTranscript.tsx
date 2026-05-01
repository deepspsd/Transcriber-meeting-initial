import { useEffect, useRef } from 'react'

interface TranscriptLine {
  speaker: string
  text: string
  timestamp: string
  color: string
}

interface LiveTranscriptProps {
  lines: TranscriptLine[]
  isRecording: boolean
}

export default function LiveTranscript({ lines, isRecording }: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current && isRecording) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, isRecording])

  if (lines.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
        }}
      >
        {isRecording ? 'Listening... transcript will appear here' : 'Start recording to see live transcript'}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        maxHeight: '400px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '1rem',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--bg-border)',
      }}
    >
      {lines.map((line, idx) => (
        <div key={idx} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className={`badge badge-${line.color}`}
              style={{ fontSize: '0.7rem', fontWeight: 700 }}
            >
              {line.speaker}
            </span>
            <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {line.timestamp}
            </span>
          </div>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {line.text}
          </p>
        </div>
      ))}
    </div>
  )
}
