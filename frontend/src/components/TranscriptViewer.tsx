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
  'var(--accent)',
  'var(--accent-2)',
  'var(--accent-warn)',
  'var(--accent-danger)',
  'var(--accent-success)',
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
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.875rem' }}>
        No transcript yet. Record or upload audio to get started.
      </div>
    )
  }
  console.log(segments)

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
        <div key={i} className="transcript-segment fade-in">
          <div
            className="speaker-name"
            style={{ color: speakerColors[seg.speaker_label] }}
          >
            {seg.is_overlap ? '⚡ ' : ''}{seg.speaker_label}
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
          <div className="seg-time">
            {formatTime(seg.start)} → {formatTime(seg.end)}
          </div>
        </div>
      ))}
      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
        <span><span className="word-hi">■</span> High confidence (&gt;85%)</span>
        <span><span className="word-mid">■</span> Medium (70–85%)</span>
        <span><span className="word-low">■</span> Low (&lt;70%)</span>
      </div>
    </div>
  )
}
