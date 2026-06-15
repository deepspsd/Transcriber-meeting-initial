import { useState } from 'react'
import { Mic, Square, RotateCcw, CheckCircle, AlertTriangle, Loader } from 'lucide-react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import WaveformVisualizer from './WaveformVisualizer'
import api from '../api/client'

interface Props {
  label?: string
  sampleIndex?: number
  onSampleSaved?: (filePath: string, sampleIndex: number) => void
  compact?: boolean
}

export default function VoiceRecorder({ label = 'self', sampleIndex = 0, onSampleSaved, compact = false }: Props) {
  const { state, formattedDuration, audioBlob, audioUrl, analyser, error, start, stop, reset } = useAudioRecorder()
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!audioBlob) return
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', audioBlob, `sample_${sampleIndex}.webm`)
      form.append('label', label)
      form.append('sample_index', String(sampleIndex))

      const res = await api.post('/voice/sample', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSaved(true)
      onSampleSaved?.(res.data.file_path, sampleIndex)
    } catch (e: any) {
      setUploadError(e.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    reset()
    setSaved(false)
    setUploadError(null)
  }

  return (
    <div className="glass" style={{ padding: compact ? '1rem' : '1.5rem', borderRadius: '12px' }}>
      {/* Waveform */}
      <div style={{ marginBottom: '1rem' }}>
        <WaveformVisualizer analyser={analyser} isActive={state === 'recording'} />
      </div>

      {/* Timer */}
      <div style={{
        textAlign: 'center',
        fontSize: '1.6rem', fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        color: state === 'recording' ? 'hsl(var(--destructive))' : 'hsl(var(--pencil))',
        marginBottom: '1rem'
      }}>
        {formattedDuration}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {state === 'idle' && !saved && (
          <button className="btn btn-primary" onClick={start} id={`record-start-${sampleIndex}`}>
            <Mic size={15} /> Start Recording
          </button>
        )}
        {state === 'recording' && (
          <button className="btn btn-danger" onClick={stop} id={`record-stop-${sampleIndex}`}>
            <Square size={15} /> Stop
          </button>
        )}
        {state === 'stopped' && !saved && (
          <>
            <button className="btn btn-ghost" onClick={handleReset}>
              <RotateCcw size={15} /> Re-record
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>
              {uploading ? <Loader size={15} className="spin" /> : <CheckCircle size={15} />}
              {uploading ? 'Saving…' : 'Save Sample'}
            </button>
          </>
        )}
        {saved && (
          <>
            <span className="badge badge-green" style={{ padding: '0.4rem 1rem' }}>
              <CheckCircle size={13} style={{ marginRight: '4px' }} /> Saved
            </span>
            <button className="btn btn-ghost" onClick={handleReset}>
              <RotateCcw size={15} /> Re-record
            </button>
          </>
        )}
      </div>

      {/* Audio preview */}
      {audioUrl && state === 'stopped' && (
        <div style={{ marginTop: '1rem' }}>
          <audio
            src={audioUrl}
            controls
            style={{
              width: '100%', height: '36px',
              accentColor: 'hsl(var(--accent))',
              borderRadius: '8px'
            }}
          />
        </div>
      )}

      {/* Errors */}
      {(error || uploadError) && (
        <div style={{
          marginTop: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '6px',
          color: 'hsl(var(--destructive))',
          fontSize: '0.82rem',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500
        }}>
          <AlertTriangle size={14} /> {error || uploadError}
        </div>
      )}
    </div>
  )
}
