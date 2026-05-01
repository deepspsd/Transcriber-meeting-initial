import { useState, useCallback, useEffect, useRef } from 'react'
import { Mic, Square, RotateCcw, Loader, AlertTriangle, Users, Radio } from 'lucide-react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useJobPoller } from '../hooks/useJobPoller'
import WaveformVisualizer from '../components/WaveformVisualizer'
import TranscriptViewer from '../components/TranscriptViewer'
import AIChatPanel from '../components/AIChatPanel'
import api from '../api/client'

type Stage = 'idle' | 'recording' | 'stopped' | 'uploading' | 'processing' | 'done' | 'error'

const PROGRESS: Record<string, string> = {
  queued: 'Queued…',
  transcribing: 'Transcribing audio…',
  diarizing: 'Identifying speakers…',
  identifying_speakers: 'Matching voice profiles…',
  generating_insights: 'Generating AI insights…',
}

// ── Cross-talk detection parameters ───────────────────────────
// Require this many consecutive positive detections before showing alert
const OVERLAP_CONFIRM_COUNT = 2
// After showing an alert, suppress new alerts for this many ms
const OVERLAP_COOLDOWN_MS = 4000

export default function RecordPage() {
  const recorder = useAudioRecorder()
  const [stage, setStage] = useState<Stage>('idle')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [overlapAlert, setOverlapAlert] = useState(false)

  // Smoothing state — not stored in React state to avoid re-render churn
  const overlapCountRef = useRef(0)
  const cooldownUntilRef = useRef(0)
  const checkingRef = useRef(false)   // prevent concurrent overlap requests

  const onDone = useCallback((data: any) => { setResult(data); setStage('done') }, [])
  const jobData = useJobPoller(stage === 'processing' ? recordingId : null, onDone)

  // ── Real-time cross-talk detection ────────────────────────────
  useEffect(() => {
    if (stage !== 'recording') {
      overlapCountRef.current = 0
      return
    }

    const interval = setInterval(async () => {
      // Skip if a previous request is still in-flight
      if (checkingRef.current) return

      const chunkBlob = recorder.latestChunkRef.current
      if (!chunkBlob || chunkBlob.size < 500) return   // skip empty/tiny chunks

      checkingRef.current = true
      try {
        const form = new FormData()
        form.append('file', chunkBlob, 'chunk.webm')

        const res = await api.post('/api/detect-overlap', form, {
          timeout: 3000,   // don't wait longer than 3 s per chunk
        })

        const isOverlap = res.data.overlap === 1

        if (isOverlap) {
          overlapCountRef.current += 1
        } else {
          overlapCountRef.current = 0
        }

        // Fire alert only after OVERLAP_CONFIRM_COUNT consecutive positives
        // and only if cooldown has expired
        if (
          overlapCountRef.current >= OVERLAP_CONFIRM_COUNT &&
          Date.now() > cooldownUntilRef.current
        ) {
          setOverlapAlert(true)
          cooldownUntilRef.current = Date.now() + OVERLAP_COOLDOWN_MS
          overlapCountRef.current = 0   // reset counter after firing
          setTimeout(() => setOverlapAlert(false), 3000)
        }
      } catch (err: any) {
        // Non-fatal — log and continue; endpoint may not be available
        console.warn('[CrossTalk] detect-overlap request failed:', err?.message ?? err)
      } finally {
        checkingRef.current = false
      }
    }, 1200)   // poll slightly faster than 1-second timeslice to catch every chunk

    return () => {
      clearInterval(interval)
      overlapCountRef.current = 0
      checkingRef.current = false
    }
  }, [stage, recorder.latestChunkRef])

  const handleStop = () => { recorder.stop(); setStage('stopped') }

  const handleSubmit = async () => {
    if (!recorder.audioBlob) return
    setStage('uploading'); setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', recorder.audioBlob, 'recording.webm')
      const res = await api.post('/audio/record', form)
      setRecordingId(res.data.recording_id)
      setStage('processing')
    } catch (e: any) {
      setUploadError(e.response?.data?.detail || 'Upload failed.')
      setStage('error')
    }
  }

  const handleReset = () => {
    recorder.reset(); setStage('idle')
    setRecordingId(null); setResult(null); setUploadError(null)
    setOverlapAlert(false)
    overlapCountRef.current = 0
    cooldownUntilRef.current = 0
  }

  const processing = stage === 'uploading' || stage === 'processing'
  const chatW = chatOpen ? '340px' : '48px'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `1fr ${chatW}`, height: '100dvh', overflow: 'hidden', transition: 'grid-template-columns .25s ease' }}>

      {/* ── Center panel ────────────────────────────── */}
      <div className="center-panel">

        {/* Header */}
        <div className="panel-header">
          <Radio size={16} style={{ color: stage === 'recording' ? 'var(--danger)' : 'var(--accent)' }} />
          <div style={{ flex: 1 }}>
            <h1>Record Conversation</h1>
            <p>Record first, then get transcription + speaker ID</p>
          </div>
          {result?.speakers_detected?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.78rem', color: 'var(--text-secondary)' }}>
              <Users size={13} />
              {result.speakers_detected.join(', ')}
            </div>
          )}
        </div>

        {/* Recorder */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Waveform */}
          <WaveformVisualizer analyser={recorder.analyser} isActive={stage === 'recording'} />

          {/* Timer */}
          <div style={{ textAlign: 'center', fontSize: '2.2rem', fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: stage === 'recording' ? 'var(--danger)' : 'var(--text-muted)', letterSpacing: '.04em' }}>
            {recorder.formattedDuration}
          </div>

          {/* Status chips */}
          {stage === 'recording' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexDirection: 'column' }}>
              <span className="badge badge-red" style={{ padding: '.35rem .9rem', fontSize: '.78rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', animation: 'pulse-rec .9s ease infinite', marginRight: '4px' }} />
                Recording
              </span>
            </div>
          )}

          {/* Cross-talk alert badge — smooth, non-blocking */}
          {overlapAlert && (
            <div
              className="badge badge-red"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
                padding: '.45rem 1rem',
                fontSize: '.82rem',
                animation: 'fadeIn .2s ease',
              }}
            >
              <AlertTriangle size={14} />
              ⚠️ Cross-talk detected — please speak one at a time
            </div>
          )}

          {processing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: 'var(--accent)', fontSize: '.875rem' }}>
              <Loader size={15} className="spin" />
              {stage === 'uploading' ? 'Uploading…' : (PROGRESS[jobData?.progress || ''] || 'Processing…')}
            </div>
          )}
          {uploadError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontSize: '.83rem', justifyContent: 'center' }}>
              <AlertTriangle size={14} /> {uploadError}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
            {stage === 'idle' && (
              <button className="record-btn idle" onClick={() => { recorder.start(); setStage('recording') }} id="main-record-btn" title="Start recording">
                <Mic size={34} color="var(--text-inverse)" />
              </button>
            )}
            {stage === 'recording' && (
              <button className="record-btn recording" onClick={handleStop} id="main-stop-btn" title="Stop">
                <Square size={28} color="var(--text-inverse)" fill="var(--text-inverse)" />
              </button>
            )}
            {stage === 'stopped' && (
              <>
                <button className="btn btn-ghost" onClick={handleReset}><RotateCcw size={15} /> Discard</button>
                <button className="btn btn-primary" onClick={handleSubmit} id="submit-btn">Analyse Recording</button>
              </>
            )}
            {processing && (
              <button className="record-btn idle" disabled style={{ opacity: .4 }}>
                <Loader size={28} color="var(--text-inverse)" className="spin" />
              </button>
            )}
            {(stage === 'done' || stage === 'error') && (
              <button className="btn btn-ghost" onClick={handleReset}><RotateCcw size={15} /> New Recording</button>
            )}
          </div>

          {/* Audio preview */}
          {recorder.audioUrl && stage === 'stopped' && (
            <audio src={recorder.audioUrl} controls style={{ width: '100%', height: 36, accentColor: 'var(--accent)' }} />
          )}
        </div>

        {/* Transcript */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          <TranscriptViewer segments={result?.transcript || []} />
        </div>
      </div>

      {/* ── AI Chat ─────────────────────────────────── */}
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
