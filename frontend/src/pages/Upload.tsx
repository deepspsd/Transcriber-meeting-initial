import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileAudio, X, Loader, CheckCircle, CloudUpload, RotateCcw } from 'lucide-react'
import { useJobPoller } from '../hooks/useJobPoller'
import TranscriptViewer from '../components/TranscriptViewer'
import AIChatPanel from '../components/AIChatPanel'
import ProcessingOverlay from '../components/ProcessingOverlay'
import PDFButton from '../components/PDFButton'
import { useProcessingStore } from '../store/processing'
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

  const { setProcessing, updateStage, clearProcessing, stage, startedAt, source } = useProcessingStore()

  const onDone = useCallback((data: any) => {
    setResult(data)
    clearProcessing()
  }, [clearProcessing])

  const jobData = useJobPoller(recordingId && !result ? recordingId : null, onDone)

  // Sync job progress → processing store
  useEffect(() => {
    if (jobData?.progress) {
      updateStage(jobData.progress as any)
    }
    if (jobData?.status === 'error') {
      clearProcessing()
    }
  }, [jobData?.progress, jobData?.status, updateStage, clearProcessing])

  // Cleanup processing state if component unmounts mid-job (edge case)
  useEffect(() => {
    return () => {
      clearProcessing()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    setProcessing('upload', 'uploading')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/audio/upload', form)
      setRecordingId(res.data.recording_id)
      updateStage('queued')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed.')
      clearProcessing()
    } finally {
      setUploading(false)
    }
  }

  const isProcessingActive = useProcessingStore((s) => s.isProcessing && s.source === 'upload')
  const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

  const chatW = chatOpen ? '340px' : '48px'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `1fr ${chatW}`,
      height: '100dvh', overflow: 'hidden',
      transition: 'grid-template-columns .25s ease',
    }}>
      {/* ── Center panel (position:relative for overlay) ── */}
      <div className="center-panel" style={{ position: 'relative' }}>

        {/* Processing overlay — covers the center panel only */}
        {isProcessingActive && (
          <ProcessingOverlay stage={stage} startedAt={startedAt} source={source} />
        )}

        {/* Header */}
        <div className="panel-header">
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
            background: result ? 'hsl(var(--success) / .12)' : 'hsl(var(--accent) / .12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${result ? 'hsl(var(--success) / .3)' : 'hsl(var(--accent) / .3)'}`,
            transition: 'all .3s',
          }}>
            {result
              ? <CheckCircle size={16} style={{ color: 'hsl(var(--success))' }} />
              : <CloudUpload size={16} style={{ color: 'hsl(var(--accent))' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{result ? 'Transcript' : 'Upload Audio'}</h1>
            <p style={{ fontSize: '.82rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', fontWeight: 400, marginTop: '1px' }}>
              {result && file ? file.name : 'WAV · MP3 · MP4 · M4A · OGG · WEBM'}
            </p>
          </div>
          {result && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <PDFButton
                recordingId={recordingId}
                filename={file?.name}
                variant="ghost"
              />
              <button
                className="btn btn-ghost animate-bounce-in"
                onClick={() => { setFile(null); setRecordingId(null); setResult(null); setError('') }}
                style={{ flexShrink: 0, fontSize: '.82rem', padding: '.4rem .85rem' }}
              >
                <RotateCcw size={14} /> New Upload
              </button>
            </div>
          )}
        </div>

        {/* Upload section — hidden after results arrive */}
        {!result && (
          <div style={{ padding: '1.75rem 2rem', borderBottom: '2px dashed hsl(var(--border))' }}>

            {/* Drop zone */}
            <div
              onDragEnter={() => setDragging(true)}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'hsl(var(--accent))' : 'hsl(var(--ink) / .2)'}`,
                borderRadius: '14px',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'hsl(var(--accent) / .06)' : 'hsl(var(--card))',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                marginBottom: '1.25rem',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Radial glow on drag */}
              <div style={{
                position: 'absolute', top: '-50%', left: '-50%',
                width: '200%', height: '200%',
                background: 'radial-gradient(circle, hsl(var(--accent) / .08) 0%, transparent 65%)',
                opacity: dragging ? 1 : 0,
                transition: 'opacity .3s',
                pointerEvents: 'none'
              }} />

              <div style={{
                width: '56px', height: '56px',
                borderRadius: '14px',
                background: dragging ? 'hsl(var(--accent) / .2)' : 'hsl(var(--accent) / .1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: `2px solid ${dragging ? 'hsl(var(--accent) / .5)' : 'hsl(var(--accent) / .2)'}`,
                transition: 'all .25s',
                position: 'relative'
              }}>
                <Upload
                  size={24}
                  style={{ color: 'hsl(var(--accent))', position: 'relative' }}
                  className={dragging ? 'animate-bounce-in' : 'animate-float'}
                />
              </div>

              <p style={{
                fontWeight: 700, marginBottom: '0.4rem', fontSize: '1rem',
                fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))', position: 'relative'
              }}>
                {dragging ? 'Drop it here!' : 'Drop audio file here'}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', position: 'relative' }}>
                or <span style={{ color: 'hsl(var(--accent))', fontWeight: 600 }}>click to browse</span>
              </p>
              <input ref={fileRef} type="file" accept="audio/*,video/*" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>

            {/* Selected file */}
            {file && (
              <div className="animate-slide-up" style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '1rem 1.25rem', marginBottom: '1rem',
                background: 'hsl(var(--card))',
                border: '1.5px solid hsl(var(--ink) / .1)',
                borderLeft: '4px solid hsl(var(--accent))',
                borderRadius: '0 10px 10px 0',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'hsl(var(--accent) / .12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid hsl(var(--accent) / .25)', flexShrink: 0
                }}>
                  <FileAudio size={18} style={{ color: 'hsl(var(--accent))' }} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontWeight: 600, fontSize: '0.9rem',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'hsl(var(--ink))', fontFamily: 'Inter, sans-serif', marginBottom: '3px'
                  }}>
                    {file.name}
                  </div>
                  <div style={{
                    fontSize: '0.78rem', color: 'hsl(var(--pencil))',
                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 500
                  }}>
                    {fmtSize(file.size)}
                  </div>
                </div>
                <button onClick={() => { setFile(null); setRecordingId(null); setResult(null) }} className="icon-btn" style={{ flexShrink: 0 }}>
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="animate-shake" style={{
                color: 'hsl(var(--destructive))', fontSize: '0.87rem', marginBottom: '1rem',
                padding: '.7rem 1rem',
                background: 'hsl(var(--destructive) / .08)',
                border: '1.5px solid hsl(var(--destructive) / .25)',
                borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Upload button */}
            {file && !recordingId && (
              <button
                className="btn btn-primary animate-slide-up"
                onClick={handleUpload}
                disabled={uploading}
                id="upload-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '.75rem 1.5rem', fontSize: '.95rem' }}
              >
                {uploading ? <Loader size={16} className="spin" /> : <CloudUpload size={16} />}
                {uploading ? 'Uploading…' : 'Process Audio'}
              </button>
            )}
          </div>
        )}

        {/* Transcript */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', background: 'hsl(var(--paper) / .4)' }}>
          {result?.transcript?.length > 0 && (
            <div className="animate-slide-up" style={{ marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'hsl(var(--ink))', fontFamily: 'Inter, sans-serif', letterSpacing: '-.01em' }}>
                Transcript
              </h3>
              <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'hsl(var(--pencil))', background: 'hsl(var(--muted))', padding: '.15rem .5rem', borderRadius: '999px', fontFamily: 'Inter, sans-serif' }}>
                {result.transcript.length} segments
              </span>
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
