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
        <div className="panel-header" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: stage === 'recording' 
              ? 'linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--accent)))' 
              : 'hsl(var(--accent))',
            animation: stage === 'recording' ? 'progress-shimmer 2s infinite' : 'none'
          }} />
          <Radio 
            size={18} 
            style={{ 
              color: stage === 'recording' ? 'hsl(var(--destructive))' : 'hsl(var(--accent))',
              transition: 'all .3s'
            }} 
            className={stage === 'recording' ? 'animate-pulse-rec' : ''}
          />
          <div style={{ flex: 1 }}>
            <h1 style={{ marginBottom: '.25rem' }}>Record Conversation</h1>
            <p style={{ 
              fontSize: '.88rem', 
              color: 'hsl(var(--pencil))',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400
            }}>
              Record first, then get transcription + speaker ID
            </p>
          </div>
          {result?.speakers_detected?.length > 0 && (
            <div className="animate-slide-in-right" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '.82rem', 
              color: 'hsl(var(--pencil))',
              padding: '.4rem .8rem',
              background: 'hsl(var(--sticky-green) / .3)',
              borderRadius: '999px',
              border: '2px solid hsl(var(--ink) / .2)'
            }}>
              <Users size={14} />
              <span style={{ fontWeight: 600 }}>{result.speakers_detected.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Recorder */}
        <div style={{ 
          padding: '2rem 1.5rem', 
          borderBottom: '2px dashed hsl(var(--border))', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem',
          background: stage === 'recording' ? 'hsl(var(--destructive) / .03)' : 'transparent',
          transition: 'background .3s'
        }}>

          {/* Waveform */}
          <div className={stage === 'recording' ? 'animate-slide-up' : ''}>
            <WaveformVisualizer analyser={recorder.analyser} isActive={stage === 'recording'} />
          </div>

          {/* Timer */}
          <div style={{ 
            textAlign: 'center', 
            fontSize: '2.5rem', 
            fontWeight: 700, 
            fontFamily: 'JetBrains Mono, monospace', 
            color: stage === 'recording' ? 'hsl(var(--destructive))' : 'hsl(var(--pencil))', 
            letterSpacing: '.06em',
            textShadow: stage === 'recording' ? '0 0 20px hsl(var(--destructive) / .3)' : 'none',
            transition: 'all .3s'
          }}>
            {recorder.formattedDuration}
          </div>

          {/* Status chips */}
          {stage === 'recording' && (
            <div className="animate-bounce-in" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              flexDirection: 'column' 
            }}>
              <span className="badge badge-red" style={{ 
                padding: '.45rem 1.1rem', 
                fontSize: '.82rem',
                fontWeight: 600,
                boxShadow: '0 0 15px hsl(var(--destructive) / .3)'
              }}>
                <span style={{ 
                  width: 9, 
                  height: 9, 
                  borderRadius: '50%', 
                  background: 'hsl(var(--destructive))', 
                  display: 'inline-block', 
                  marginRight: '6px',
                  boxShadow: '0 0 8px hsl(var(--destructive))'
                }} className="animate-pulse-rec" />
                Recording
              </span>
            </div>
          )}

          {/* Cross-talk alert badge — smooth, non-blocking */}
          {overlapAlert && (
            <div
              className="badge badge-red animate-shake"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                padding: '.55rem 1.2rem',
                fontSize: '.85rem',
                fontWeight: 600,
                boxShadow: '0 4px 12px hsl(var(--destructive) / .3)'
              }}
            >
              <AlertTriangle size={16} />
              ⚠️ Cross-talk detected — please speak one at a time
            </div>
          )}

          {processing && (
            <div className="animate-fade-in" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              justifyContent: 'center', 
              color: 'hsl(var(--accent))', 
              fontSize: '.9rem',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}>
              <Loader size={16} className="spin" />
              {stage === 'uploading' ? 'Uploading…' : (PROGRESS[jobData?.progress || ''] || 'Processing…')}
            </div>
          )}
          {uploadError && (
            <div className="animate-shake" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              color: 'hsl(var(--destructive))', 
              fontSize: '.86rem', 
              justifyContent: 'center',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}>
              <AlertTriangle size={16} /> {uploadError}
            </div>
          )}

          {/* Controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '18px',
            marginTop: '.5rem'
          }}>
            {stage === 'idle' && (
              <button 
                className="record-btn idle" 
                onClick={() => { recorder.start(); setStage('recording') }} 
                id="main-record-btn" 
                title="Start recording"
              >
                <Mic size={38} color="hsl(var(--accent-foreground))" />
              </button>
            )}
            {stage === 'recording' && (
              <button 
                className="record-btn recording" 
                onClick={handleStop} 
                id="main-stop-btn" 
                title="Stop"
              >
                <Square size={32} color="hsl(var(--accent-foreground))" fill="hsl(var(--accent-foreground))" />
              </button>
            )}
            {stage === 'stopped' && (
              <div className="animate-slide-up" style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-ghost" onClick={handleReset}>
                  <RotateCcw size={16} /> Discard
                </button>
                <button className="btn btn-primary" onClick={handleSubmit} id="submit-btn">
                  Analyse Recording
                </button>
              </div>
            )}
            {processing && (
              <button className="record-btn idle" disabled style={{ opacity: .5 }}>
                <Loader size={32} color="hsl(var(--accent-foreground))" className="spin" />
              </button>
            )}
            {(stage === 'done' || stage === 'error') && (
              <button className="btn btn-ghost animate-bounce-in" onClick={handleReset}>
                <RotateCcw size={16} /> New Recording
              </button>
            )}
          </div>

          {/* Audio preview */}
          {recorder.audioUrl && stage === 'stopped' && (
            <div className="animate-slide-up" style={{ marginTop: '.5rem' }}>
              <audio 
                src={recorder.audioUrl} 
                controls 
                style={{ 
                  width: '100%', 
                  height: 42, 
                  accentColor: 'hsl(var(--accent))',
                  borderRadius: '12px',
                  filter: 'url(#squiggle-soft)'
                }} 
              />
            </div>
          )}
        </div>

        {/* Transcript */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '1.5rem 1.75rem',
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
