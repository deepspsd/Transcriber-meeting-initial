/**
 * PDFButton.tsx
 * A self-contained button that generates and downloads a PDF report.
 * Matches the VoiceSum "sketchy blueprint" design system.
 */
import { useState } from 'react'
import { FileDown, Loader, CheckCircle, AlertTriangle } from 'lucide-react'
import { downloadPdfReport } from '../services/pdfService'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface Props {
  recordingId: string | null | undefined
  filename?: string
  /** Visual variant — defaults to 'ghost' */
  variant?: 'ghost' | 'primary' | 'outline'
  className?: string
  style?: React.CSSProperties
}

export default function PDFButton({
  recordingId,
  filename,
  variant = 'ghost',
  className = '',
  style,
}: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleClick = async () => {
    if (!recordingId || status === 'loading') return
    setStatus('loading')
    setErrorMsg(null)

    try {
      await downloadPdfReport(recordingId, filename)
      setStatus('success')
      // Reset back to idle after 2.5s
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err: any) {
      const msg = err?.message || 'PDF generation failed'
      setErrorMsg(msg)
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setErrorMsg(null) }, 4000)
    }
  }

  const isDisabled = !recordingId || status === 'loading'

  // ── Icon & label per status
  const content = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader size={14} className="spin" />
            <span>Generating…</span>
          </>
        )
      case 'success':
        return (
          <>
            <CheckCircle size={14} style={{ color: 'hsl(var(--success))' }} />
            <span style={{ color: 'hsl(var(--success))' }}>Downloaded!</span>
          </>
        )
      case 'error':
        return (
          <>
            <AlertTriangle size={14} style={{ color: 'hsl(var(--destructive))' }} />
            <span style={{ color: 'hsl(var(--destructive))' }}>Failed</span>
          </>
        )
      default:
        return (
          <>
            <FileDown size={14} />
            <span>Export PDF</span>
          </>
        )
    }
  }

  // ── Button class based on variant
  const btnClass =
    variant === 'primary'
      ? 'btn btn-primary'
      : variant === 'outline'
      ? 'btn'
      : 'btn btn-ghost'

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <button
        id="pdf-export-btn"
        className={`${btnClass} ${className}`}
        onClick={handleClick}
        disabled={isDisabled}
        title={
          !recordingId
            ? 'Process a recording first'
            : status === 'loading'
            ? 'Generating PDF report…'
            : 'Download professional PDF report'
        }
        style={{
          flexShrink: 0,
          fontSize: '.82rem',
          padding: '.4rem .85rem',
          height: '36px',
          gap: '6px',
          position: 'relative',
          overflow: 'hidden',
          // Loading shimmer effect
          ...(status === 'loading' && {
            background: 'linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--card)) 50%, hsl(var(--muted)) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
            border: '1.5px solid hsl(var(--border) / .3)',
            color: 'hsl(var(--pencil))',
            boxShadow: 'none',
            transform: 'none',
          }),
          ...style,
        }}
      >
        {content()}
      </button>

      {/* Inline error tooltip */}
      {status === 'error' && errorMsg && (
        <div
          className="animate-slide-up"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'hsl(var(--destructive) / .12)',
            border: '1px solid hsl(var(--destructive) / .4)',
            borderRadius: '6px',
            padding: '.35rem .65rem',
            fontSize: '.72rem',
            color: 'hsl(var(--destructive))',
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
            maxWidth: '280px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            zIndex: 50,
            boxShadow: '0 4px 12px hsl(var(--destructive) / .15)',
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  )
}
