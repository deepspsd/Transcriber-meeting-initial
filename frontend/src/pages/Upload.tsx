import { useState, useRef, useCallback } from 'react'
import { Upload, FileAudio, X, Loader, CheckCircle } from 'lucide-react'
import { useJobPoller } from '../hooks/useJobPoller'
import TranscriptViewer from '../components/TranscriptViewer'
import AIChatPanel from '../components/AIChatPanel'
import api from '../api/client'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [chatOpen, setChatOpen] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const onDone = useCallback((data: any) => setResult(data), [])
  const jobData = useJobPoller(recordingId && !result ? recordingId : null, onDone)

  const handleFile = (f: File) => {
    setFile(f)
    setResult(null)
    setRecordingId(null)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/audio/upload', form)
      setRecordingId(res.data.recording_id)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const isProcessing = recordingId && !result
  const PROGRESS_LABELS: Record<string, string> = { 
    queued: 'Queued', 
    transcribing: 'Transcribing…', 
    diarizing: 'Diarizing…', 
    identifying_speakers: 'Matching voices…', 
    generating_insights: 'AI insights…' 
  }

  const chatW = chatOpen ? '340px' : '48px'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `1fr ${chatW}`, height: '100dvh', overflow: 'hidden', transition: 'grid-template-columns .25s ease' }}>
      <div className="center-panel">
        <div className="panel-header">
          <Upload size={20} style={{ color: 'hsl(var(--accent))' }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ marginBottom: '.25rem' }}>Upload Audio</h1>
            <p style={{ 
              fontSize: '.88rem', 
              color: 'hsl(var(--pencil))',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400
            }}>
              Upload WAV, MP3, MP4, M4A, OGG, WEBM files
            </p>
          </div>
        </div>

        <div style={{ padding: '2rem 1.75rem' }}>
          {/* Drop zone */}
          <div
            onDragEnter={() => setDragging(true)}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={dragging ? 'animate-pulse-glow' : ''}
            style={{
              border: `3px dashed ${dragging ? 'hsl(var(--accent))' : 'hsl(var(--ink) / .25)'}`,
              borderRadius: '16px 22px 18px 24px / 22px 16px 24px 18px',
              padding: '4rem 2.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'hsl(var(--accent) / .08)' : 'hsl(var(--card))',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              marginBottom: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle, hsl(var(--accent) / .05) 0%, transparent 70%)',
              opacity: dragging ? 1 : 0,
              transition: 'opacity .3s'
            }} />
            <Upload 
              size={48} 
              style={{ 
                color: 'hsl(var(--accent))', 
                marginBottom: '1.25rem',
                position: 'relative'
              }} 
              className={dragging ? 'animate-bounce-in' : 'animate-float'}
            />
            <p style={{ 
              fontWeight: 600, 
              marginBottom: '0.5rem',
              fontSize: '1.05rem',
              fontFamily: 'Inter, sans-serif',
              color: 'hsl(var(--ink))',
              position: 'relative'
            }}>
              Drop audio file here
            </p>
            <p style={{ 
              fontSize: '0.88rem', 
              color: 'hsl(var(--pencil))',
              fontFamily: 'Inter, sans-serif',
              position: 'relative'
            }}>
              or click to browse
            </p>
            <input 
              ref={fileRef} 
              type="file" 
              accept="audio/*,video/*" 
              hidden 
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
            />
          </div>

          {/* Selected file */}
          {file && (
            <div className="glass animate-slide-up" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '1rem 1.2rem', 
              marginBottom: '1.25rem' 
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'hsl(var(--accent) / .15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid hsl(var(--accent) / .3)',
                flexShrink: 0
              }}>
                <FileAudio size={20} style={{ color: 'hsl(var(--accent))' }} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: '0.92rem', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  color: 'hsl(var(--ink))',
                  fontFamily: 'Inter, sans-serif',
                  marginBottom: '3px'
                }}>
                  {file.name}
                </div>
                <div style={{ 
                  fontSize: '0.78rem', 
                  color: 'hsl(var(--pencil))',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 500
                }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <button 
                onClick={() => { setFile(null); setRecordingId(null); setResult(null) }} 
                className="icon-btn"
                style={{ flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="animate-shake" style={{ 
              color: 'hsl(var(--destructive))', 
              fontSize: '0.88rem', 
              marginBottom: '1rem',
              padding: '.75rem 1rem',
              background: 'hsl(var(--destructive) / .1)',
              border: '2px solid hsl(var(--destructive) / .3)',
              borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {/* Upload button */}
          {file && !recordingId && (
            <button 
              className="btn btn-primary animate-slide-up" 
              onClick={handleUpload} 
              disabled={uploading} 
              id="upload-btn" 
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {uploading ? <Loader size={16} className="spin" /> : <Upload size={16} />}
              {uploading ? 'Uploading…' : 'Process Audio'}
            </button>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="animate-fade-in" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              color: 'hsl(var(--accent))', 
              fontSize: '0.9rem', 
              marginTop: '1.25rem',
              padding: '.75rem 1rem',
              background: 'hsl(var(--accent) / .08)',
              borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px',
              border: '2px dashed hsl(var(--accent) / .3)',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}>
              <Loader size={16} className="spin" />
              {PROGRESS_LABELS[jobData?.progress || ''] || 'Processing…'}
            </div>
          )}

          {result && (
            <div className="animate-bounce-in" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              color: 'hsl(var(--sticky-green))', 
              fontSize: '0.9rem', 
              marginTop: '1.25rem',
              padding: '.75rem 1rem',
              background: 'hsl(var(--sticky-green) / .2)',
              borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px',
              border: '2px solid hsl(var(--ink) / .2)',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600
            }}>
              <CheckCircle size={16} /> Processing complete!
            </div>
          )}
        </div>

        {/* Transcript */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '0 1.75rem 1.75rem',
          background: 'hsl(var(--paper) / .5)'
        }}>
          {result?.transcript?.length > 0 && (
            <div className="animate-slide-up" style={{ marginBottom: '1rem' }}>
              <h3 style={{ 
                fontSize: '1.1rem', 
                fontWeight: 700, 
                color: 'hsl(var(--ink))',
                fontFamily: 'Caveat, cursive',
                marginBottom: '.5rem'
              }}>
                Transcript
              </h3>
            </div>
          )}
          <TranscriptViewer segments={result?.transcript || []} />
        </div>
      </div>

      <AIChatPanel
        recordingId={recordingId}
        summary={result?.summary}
        keyPoints={result?.key_points}
        actionItems={result?.action_items}
        isOpen={chatOpen}
        onToggle={() => setChatOpen((o) => !o)}
      />
    </div>
  )
}
