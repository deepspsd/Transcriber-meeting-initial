import { FileText, Lightbulb, CheckSquare, Users } from 'lucide-react'

interface SummaryPanelProps {
  summary?: string
  keyPoints?: string[]
  actionItems?: string[]
  speakers?: Array<{ name: string; percentage: number }>
}

export default function SummaryPanel({ summary, keyPoints, actionItems, speakers }: SummaryPanelProps) {
  if (!summary && !keyPoints && !actionItems && !speakers) {
    return (
      <div
        className="glass"
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <FileText size={32} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
        <p>No summary available yet</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {summary && (
        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FileText size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Summary</h3>
          </div>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {summary}
          </p>
        </div>
      )}

      {keyPoints && keyPoints.length > 0 && (
        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Lightbulb size={18} style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Key Points</h3>
          </div>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {keyPoints.map((point, idx) => (
              <li key={idx} style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {actionItems && actionItems.length > 0 && (
        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <CheckSquare size={18} style={{ color: 'var(--success)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Action Items</h3>
          </div>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {actionItems.map((item, idx) => (
              <li key={idx} style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {speakers && speakers.length > 0 && (
        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Users size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Speakers Overview</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {speakers.map((speaker, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {speaker.name}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {speaker.percentage}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    background: 'var(--bg-elevated)',
                    borderRadius: '99px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${speaker.percentage}%`,
                      background: 'var(--accent)',
                      borderRadius: '99px',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
