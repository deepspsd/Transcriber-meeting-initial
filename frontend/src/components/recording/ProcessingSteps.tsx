import { CheckCircle, Loader } from 'lucide-react'

interface Step {
  label: string
  status: 'pending' | 'active' | 'complete'
}

interface ProcessingStepsProps {
  steps: Step[]
}

export default function ProcessingSteps({ steps }: ProcessingStepsProps) {
  return (
    <div
      className="glass fade-in"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '500px',
        margin: '0 auto',
      }}
    >
      <h3 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', color: 'var(--text-primary)' }}>
        Processing Recording
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {steps.map((step, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: step.status === 'active' ? 'var(--accent-subtle)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.3s ease',
            }}
          >
            {step.status === 'complete' && (
              <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
            )}
            {step.status === 'active' && (
              <Loader size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} className="spin" />
            )}
            {step.status === 'pending' && (
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-border)',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: step.status === 'active' ? 600 : 400,
                color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
