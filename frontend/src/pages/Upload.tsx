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
  const jobData = useJobPoller(uploading || result ? recordingId : null, onDone)

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
  const PROGRESS_LABELS: Record<string, string> = { queued: 'Queued', transcribing: 'Transcribing…', diarizing: 'Diarizing…', identifying_speakers: 'Matching voices…', generating_insights: 'AI insights…' }

  const chatW = chatOpen ? '340px' : '48px'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `1fr ${chatW}`, height: '100dvh', overflow: 'hidden', transition: 'grid-template-columns .25s ease' }}>
      <div className="center-panel">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--bg-border)' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Upload Audio</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload WAV, MP3, MP4, M4A, OGG, WEBM files</p>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Drop zone */}
          <div
            onDragEnter={() => setDragging(true)}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--bg-border)'}`,
              borderRadius: 'var(--radius)',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'rgba(124,92,252,0.05)' : 'transparent',
              transition: 'all 0.18s',
              marginBottom: '1rem',
            }}
          >
            <Upload size={32} style={{ color: 'var(--accent)', marginBottom: '0.75rem' }} />
            <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Drop audio file here</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>or click to browse</p>
            <input ref={fileRef} type="file" accept="audio/*,video/*" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {/* Selected file */}
          {file && (
            <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <FileAudio size={18} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <button onClick={() => { setFile(null); setRecordingId(null); setResult(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
          )}

          {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.83rem', marginBottom: '0.75rem' }}>{error}</div>}

          {/* Upload button */}
          {file && !recordingId && (
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} id="upload-btn" style={{ width: '100%', justifyContent: 'center' }}>
              {uploading ? <Loader size={15} className="spin" /> : <Upload size={15} />}
              {uploading ? 'Uploading…' : 'Process Audio'}
            </button>
          )}

          {/* Progress */}
          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '0.875rem', marginTop: '1rem' }}>
              <Loader size={15} className="spin" />
              {PROGRESS_LABELS[jobData?.progress || ''] || 'Processing…'}
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-success)', fontSize: '0.875rem', marginTop: '1rem' }}>
              <CheckCircle size={15} /> Processing complete!
            </div>
          )}
        </div>

        {/* Transcript */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
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
