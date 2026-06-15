interface Word {
  word: string
  start: number
  end: number
  probability: number
}

interface Segment {
  speaker_label: string
  start: number
  end: number
  text: string
  words: Word[]
  is_overlap: boolean
}

interface Props {
  segments: Segment[]
  wordConfLow?: number
  wordConfMid?: number
}

const SPEAKER_COLORS = [
  'hsl(14, 90%, 56%)',    // accent orange-red
  'hsl(205, 90%, 55%)',   // blue
  'hsl(130, 60%, 45%)',   // green
  'hsl(280, 70%, 60%)',   // purple
  'hsl(45, 90%, 50%)',    // yellow
  'hsl(340, 80%, 60%)',   // pink
]

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function wordClass(prob: number, low: number, mid: number) {
  if (prob < low) return 'word-low'
  if (prob < mid) return 'word-mid'
  return 'word-hi'
}

export default function TranscriptViewer({ segments, wordConfLow = 0.7, wordConfMid = 0.85 }: Props) {
  if (!segments || segments.length === 0) {
    return (
      <div style={{ 
        color: 'hsl(var(--pencil))', 
        textAlign: 'center', 
        padding: '3rem 2rem', 
        fontSize: '0.95rem',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{
          width: '56px', height: '56px',
          borderRadius: '50%',
          background: 'hsl(var(--muted))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', opacity: 0.5
        }}>🎤</div>
        <div>
          <p style={{ fontWeight: 600, marginBottom: '.35rem', color: 'hsl(var(--ink-soft))' }}>No transcript yet</p>
          <p style={{ fontSize: '.85rem', opacity: .7 }}>Record or upload audio to get started</p>
        </div>
      </div>
    )
  }

  // Build speaker → color map
  const speakerColors: Record<string, string> = {}
  let colorIdx = 0
  for (const seg of segments) {
    if (!(seg.speaker_label in speakerColors)) {
      speakerColors[seg.speaker_label] = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length]
      colorIdx++
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="transcript-segment animate-slide-up"
          style={{
            '--speaker-color': speakerColors[seg.speaker_label],
            animationDelay: `${Math.min(i * 0.04, 0.5)}s`,
            animationFillMode: 'both',
          } as React.CSSProperties}
        >
          <div className="seg-meta">
            <span
              className="speaker-name"
              style={{ color: speakerColors[seg.speaker_label] }}
            >
              {seg.is_overlap ? '⚡ ' : ''}{seg.speaker_label}
            </span>
            <span className="seg-time">
              {formatTime(seg.start)} → {formatTime(seg.end)}
            </span>
            {seg.is_overlap && (
              <span style={{
                fontSize: '.7rem', fontWeight: 600,
                color: 'hsl(var(--destructive))',
                background: 'hsl(var(--destructive) / .1)',
                border: '1px solid hsl(var(--destructive) / .3)',
                borderRadius: '999px',
                padding: '.1rem .45rem',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '.03em'
              }}>
                OVERLAP
              </span>
            )}
          </div>
          <div className="seg-text">
            {seg.words && seg.words.length > 0
              ? seg.words.map((w, wi) => (
                <span
                  key={wi}
                  className={wordClass(w.probability, wordConfLow, wordConfMid)}
                  title={`${(w.probability * 100).toFixed(0)}% confidence`}
                >
                  {w.word}{' '}
                </span>
              ))
              : seg.text}
          </div>
        </div>
      ))}
      
      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        padding: '1rem 1.1rem', 
        fontSize: '0.8rem', 
        color: 'hsl(var(--ink-soft))',
        marginTop: '1rem',
        background: 'hsl(var(--card))',
        borderRadius: '10px',
        border: '1px solid hsl(var(--ink) / .1)',
        flexWrap: 'wrap',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '.72rem', color: 'hsl(var(--pencil))', textTransform: 'uppercase', letterSpacing: '.08em', marginRight: '.25rem' }}>Confidence:</span>
        {[
          { label: 'High >85%', cls: 'word-hi' },
          { label: 'Mid 70–85%', cls: 'word-mid' },
          { label: 'Low <70%', cls: 'word-low' },
        ].map(({ label, cls }) => (
          <span key={cls} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className={cls} style={{ fontSize: '.78rem', padding: '1px 6px' }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
