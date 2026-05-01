export default function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass"
          style={{
            padding: '1.25rem',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        >
          <div
            style={{
              height: '16px',
              background: 'var(--bg-elevated)',
              borderRadius: '4px',
              marginBottom: '8px',
              width: '60%',
            }}
          />
          <div
            style={{
              height: '12px',
              background: 'var(--bg-elevated)',
              borderRadius: '4px',
              width: '40%',
            }}
          />
        </div>
      ))}
    </div>
  )
}
