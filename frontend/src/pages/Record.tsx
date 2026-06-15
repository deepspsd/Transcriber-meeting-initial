import { useState, useCallback, useEffect, useRef } from 'react'
import { Mic, Square, RotateCcw, Loader, AlertTriangle, Users, Radio, CheckCircle } from 'lucide-react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useJobPoller } from '../hooks/useJobPoller'
import WaveformVisualizer from '../components/WaveformVisualizer'
import TranscriptViewer from '../components/TranscriptViewer'
import AIChatPanel from '../components/AIChatPanel'
import ProcessingOverlay from '../components/ProcessingOverlay'
import { useProcessingStore } from '../store/processing'
import api from '../api/client'

type Stage = 'idle' | 'recording' | 'stopped' | 'uploading' | 'processing' | 'done' | 'error'

const PROGRESS: Record<string, string> = {
  queued: 'Queued…',
  transcribing: 'Transcribing audio…',
  diarizing: 'Identifying speakers…',
  identifying_speakers: 'Matching voice profiles…',
  generating_insights: 'Generating AI insights…',
}

const OVERLAP_CONFIRM_COUNT = 2
const OVERLAP_COOLDOWN_MS = 4000

export default function RecordPage() {
  const recorder = useAudioRecorder()
  const [stage, setStage] = useState<Stage>('idle')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [overlapAlert, setOverlapAlert] = useState(false)

  const overlapCountRef = useRef(0)
  const cooldownUntilRef = useRef(0)
  const checkingRef = useRef(false)

  const { setProcessing, updateStage: updateProcStage, clearProcessing, stage: procStage, startedAt, source } = useProcessingStore()

  const onDone = useCallback((data: any) => {
    setResult(data)
    setStage('done')
    clearProcessing()
  }, [clearProcessing])

  const jobData = useJobPoller(stage === 'processing' ? recordingId : null, onDone)

  // Sync job progress → global processing store
  useEffect(() => {
    if (jobData?.progress) {
      updateProcStage(jobData.progress as any)
    }
    if (jobData?.status === 'error') {
      setStage('error')
      clearProcessing()
    }
  }, [jobData?.progress, jobData?.status, updateProcStage, clearProcessing])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearProcessing()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-talk detection
  useEffect(() => {
    if (stage !== 'recording') {
      overlapCountRef.current = 0
      return
    }
    const interval = setInterval(async () => {
      if (checkingRef.current) return
      const chunkBlob = recorder.latestChunkRef.current
      if (!chunkBlob || chunkBlob.size < 500) return
      checkingRef.current = true
      try {
        const form = new FormData()
        form.append('file', chunkBlob, 'chunk.webm')
        const res = await api.post('/api/detect-overlap', form, { timeout: 3000 })
        const isOverlap = res.data.overlap === 1
        if (isOverlap) {
          overlapCountRef.current += 1
        } else {
          overlapCountRef.current = 0
        }
        if (overlapCountRef.current >= OVERLAP_CONFIRM_COUNT && Date.now() > cooldownUntilRef.current) {
          setOverlapAlert(true)
          cooldownUntilRef.current = Date.now() + OVERLAP_COOLDOWN_MS
          overlapCountRef.current = 0
          setTimeout(() => setOverlapAlert(false), 3000)
        }
      } catch (err: any) {
        console.warn('[CrossTalk] detect-overlap request failed:', err?.message ?? err)
      } finally {
        checkingRef.current = false
      }
    }, 1200)
    return () => {
      clearInterval(interval)
      overlapCountRef.current = 0
      checkingRef.current = false
    }
  }, [stage, recorder.latestChunkRef])

  const handleStop = () => { recorder.stop(); setStage('stopped') }

  const handleSubmit = async () => {
    if (!recorder.audioBlob) return
    setStage('uploading')
    setUploadError(null)
    setProcessing('record', 'uploading')
    try {
      const form = new FormData()
      form.append('file', recorder.audioBlob, 'recording.webm')
      const res = await api.post('/audio/record', form)
      setRecordingId(res.data.recording_id)
      setStage('processing')
      updateProcStage('queued')
    } catch (e: any) {
      setUploadError(e.response?.data?.detail || 'Upload failed.')
      setStage('error')
      clearProcessing()
    }
  }

  const handleReset = () => {
    recorder.reset(); setStage('idle')
    setRecordingId(null); setResult(null); setUploadError(null)
    setOverlapAlert(false)
    overlapCountRef.current = 0
    cooldownUntilRef.current = 0
    clearProcessing()
  }

  const processing = stage === 'uploading' || stage === 'processing'
  const isProcessingActive = useProcessingStore.getState().isProcessing && useProcessingStore.getState().source === 'record'
  const chatW = chatOpen ? '340px' : '48px'
  const isRecording = stage === 'recording'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `1fr ${chatW}`, height: '100dvh', overflow: 'hidden', transition: 'grid-template-columns .25s ease' }}>

      {/* ── Center panel */}
      <div className="center-panel" style={{ position: 'relative' }}>

        {/* Processing overlay */}
        {processing && (
          <ProcessingOverlay stage={procStage} startedAt={startedAt} source={source} />
        )}

        {/* Header */}
        <div className="panel-header" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Stage progress bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
            background: isRecording
              ? 'linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--accent)), hsl(var(--destructive)))'
              : stage === 'done'
              ? 'hsl(var(--success))'
              : 'hsl(var(--accent))',
            backgroundSize: isRecording ? '200% 100%' : '100% 100%',
            animation: isRecording ? 'progress-shimmer 2s linear infinite' : 'none',
            transition: 'background .5s'
          }} />

          <div style={{
            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
            background: result ? 'hsl(var(--success) / .12)' : isRecording ? 'hsl(var(--destructive) / .15)' : 'hsl(var(--accent) / .12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${result ? 'hsl(var(--success) / .3)' : isRecording ? 'hsl(var(--destructive) / .4)' : 'hsl(var(--accent) / .3)'}`,
            transition: 'all .3s'
          }}>
            {result
              ? <CheckCircle size={16} style={{ color: 'hsl(var(--success))' }} />
              : <Radio
                  size={16}
                  style={{ color: isRecording ? 'hsl(var(--destructive))' : 'hsl(var(--accent))', transition: 'all .3s' }}
                  className={isRecording ? 'animate-pulse-rec' : ''}
                />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{result ? 'Transcript' : 'Record Conversation'}</h1>
            <p style={{ fontSize: '.82rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', fontWeight: 400, marginTop: '1px' }}>
              {result ? `${result.transcript?.length ?? 0} segments` : 'Record first, then get transcription + speaker ID'}
            </p>
          </div>

          {result?.speakers_detected?.length > 0 && (
            <div className="animate-slide-in-right" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '.8rem', color: 'hsl(var(--success))',
              padding: '.35rem .8rem',
              background: 'hsl(var(--success) / .12)',
              borderRadius: '999px',
              border: '1.5px solid hsl(var(--success) / .3)',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              flexShrink: 0
            }}>
              <Users size={13} style={{ color: 'hsl(var(--success))' }} />
              <span>{result.speakers_detected.join(', ')}</span>
            </div>
          )}

          {result && (
            <button
              className="btn btn-ghost animate-bounce-in"
              onClick={handleReset}
              style={{ flexShrink: 0, fontSize: '.82rem', padding: '.4rem .85rem' }}
            >
              <RotateCcw size={14} /> New Recording
            </button>
          )}
        </div>

        {/* Recording Section — hidden after results arrive */}
        {!result && (<div style={{
          padding: '1.75rem 2rem',
          borderBottom: '2px dashed hsl(var(--border))',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          background: isRecording
            ? 'linear-gradient(180deg, hsl(var(--destructive) / .04) 0%, transparent 100%)'
            : 'transparent',
          transition: 'background .4s',
          position: 'relative'
        }}>

          {/* Waveform */}
          <div style={{ width: '100%' }}>
            <WaveformVisualizer
              analyser={recorder.analyser}
              isActive={isRecording}
              height={80}
            />
          </div>

          {/* Timer */}
          <div style={{
            textAlign: 'center',
            fontSize: '2.8rem',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: isRecording ? 'hsl(var(--destructive))' : stage === 'done' ? 'hsl(var(--success))' : 'hsl(var(--pencil))',
            letterSpacing: '.08em',
            lineHeight: 1,
            textShadow: isRecording ? '0 0 28px hsl(var(--destructive) / .4)' : stage === 'done' ? '0 0 20px hsl(var(--success) / .3)' : 'none',
            transition: 'all .3s'
          }}>
            {recorder.formattedDuration}
          </div>

          {/* Status indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>

            {isRecording && (
              <div className="animate-bounce-in" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '.4rem 1rem',
                  background: 'hsl(var(--destructive) / .12)',
                  border: '1.5px solid hsl(var(--destructive) / .3)',
                  borderRadius: '999px',
                  fontSize: '.82rem', fontWeight: 600,
                  color: 'hsl(var(--destructive))',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 0 12px hsl(var(--destructive) / .15)'
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'hsl(var(--destructive))',
                    display: 'inline-block',
                    boxShadow: '0 0 6px hsl(var(--destructive))'
                  }} className="animate-pulse-rec" />
                  RECORDING
                </span>
              </div>
            )}

            {overlapAlert && (
              <div className="animate-shake" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '.45rem 1rem',
                background: 'hsl(var(--destructive) / .1)',
                border: '1.5px solid hsl(var(--destructive) / .4)',
                borderRadius: '999px',
                fontSize: '.82rem', fontWeight: 600,
                color: 'hsl(var(--destructive))',
                fontFamily: 'Inter, sans-serif',
              }}>
                <AlertTriangle size={14} />
                Cross-talk detected — please speak one at a time
              </div>
            )}

            {uploadError && (
              <div className="animate-shake" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                color: 'hsl(var(--destructive))',
                fontSize: '.86rem',
                justifyContent: 'center',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500
              }}>
                <AlertTriangle size={16} /> {uploadError}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '18px' }}>
            {stage === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <button
                  className="record-btn idle"
                  onClick={() => { recorder.start(); setStage('recording') }}
                  id="main-record-btn"
                  title="Start recording"
                >
                  <Mic size={38} color="hsl(var(--accent-foreground))" />
                </button>
                <span style={{ fontSize: '.78rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif' }}>
                  Click to record
                </span>
              </div>
            )}
            {isRecording && (
              <button
                className="record-btn recording"
                onClick={handleStop}
                id="main-stop-btn"
                title="Stop recording"
              >
                <Square size={32} color="hsl(var(--accent-foreground))" fill="hsl(var(--accent-foreground))" />
              </button>
            )}
            {stage === 'stopped' && (
              <div className="animate-slide-up" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button className="btn btn-ghost" onClick={handleReset}>
                  <RotateCcw size={15} /> Discard
                </button>
                <button className="btn btn-primary" onClick={handleSubmit} id="submit-btn">
                  Analyse Recording
                </button>
              </div>
            )}
            {processing && (
              <button className="record-btn idle" disabled style={{ opacity: .5, cursor: 'not-allowed' }}>
                <Loader size={32} color="hsl(var(--accent-foreground))" className="spin" />
              </button>
            )}
            {(stage === 'done' || stage === 'error') && (
              <button className="btn btn-ghost animate-bounce-in" onClick={handleReset}>
                <RotateCcw size={15} /> New Recording
              </button>
            )}
          </div>

          {/* Audio preview */}
          {recorder.audioUrl && stage === 'stopped' && (
            <div className="animate-slide-up">
              <audio
                src={recorder.audioUrl}
                controls
                style={{
                  width: '100%',
                  height: 40,
                  accentColor: 'hsl(var(--accent))',
                  borderRadius: '10px',
                }}
              />
            </div>
          )}
        </div>)}

        {/* Transcript */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem 1.5rem',
          background: 'hsl(var(--paper) / .4)'
        }}>
          {result?.transcript?.length > 0 && (
            <div className="animate-slide-up" style={{ marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'hsl(var(--ink))',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '-.01em'
              }}>
                Transcript
              </h3>
              <span style={{
                fontSize: '.72rem', fontWeight: 600,
                color: 'hsl(var(--pencil))',
                background: 'hsl(var(--muted))',
                padding: '.15rem .5rem',
                borderRadius: '999px',
                fontFamily: 'Inter, sans-serif'
              }}>
                {result.transcript.length} segments
              </span>
            </div>
          )}
          <TranscriptViewer segments={result?.transcript || []} />
        </div>
      </div>

      {/* AI Chat */}
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
