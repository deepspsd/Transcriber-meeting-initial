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
  'hsl(var(--accent))',
  'hsl(var(--sticky-blue))',
  'hsl(var(--sticky-purple))',
  'hsl(var(--sticky-green))',
  'hsl(var(--sticky-indigo))',
  '#f6ad55',
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
        padding: '3rem', 
        fontSize: '0.95rem',
        fontFamily: 'Inter, sans-serif'
      }}>
        No transcript yet. Record or upload audio to get started.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {segments.map((seg, i) => (
        <div key={i} className="transcript-segment animate-slide-up" style={{
          animationDelay: `${i * 0.05}s`,
          animationFillMode: 'both'
        }}>
          <div
            className="speaker-name"
            style={{ 
              color: speakerColors[seg.speaker_label],
              marginBottom: '.5rem'
            }}
          >
            {seg.is_overlap ? '⚡ ' : ''}{seg.speaker_label}
          </div>
          <div className="seg-text" style={{ marginBottom: '.5rem' }}>
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
          <div className="seg-time">
            {formatTime(seg.start)} → {formatTime(seg.end)}
          </div>
        </div>
      ))}
      
      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        gap: '1.5rem', 
        padding: '1.25rem 1rem', 
        fontSize: '0.85rem', 
        color: 'hsl(var(--ink-soft))',
        marginTop: '1rem',
        background: 'hsl(var(--card) / .5)',
        borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px',
        border: '2px dashed hsl(var(--ink) / .2)',
        flexWrap: 'wrap',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            background: 'hsl(var(--sticky-green) / .35)',
            border: '1px solid hsl(var(--sticky-green) / .5)',
            borderRadius: '4px'
          }} />
          <span>High confidence (&gt;85%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            background: 'hsl(var(--sticky-yellow) / .45)',
            border: '1px solid hsl(45 90% 55%)',
            borderRadius: '4px'
          }} />
          <span>Medium (70–85%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            background: 'hsl(var(--destructive) / .25)',
            border: '1px solid hsl(var(--destructive) / .5)',
            borderRadius: '4px'
          }} />
          <span>Low (&lt;70%)</span>
        </div>
      </div>
    </div>
  )
}
