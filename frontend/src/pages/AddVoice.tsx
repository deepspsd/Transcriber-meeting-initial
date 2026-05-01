import { useState } from 'react'
import { CheckCircle, UserPlus, Loader, AlertTriangle, Sparkles, Mic } from 'lucide-react'
import VoiceRecorder from '../components/VoiceRecorder'
import api from '../api/client'

const STEPS = [
  { title: 'Sample 1', instruction: 'Record a clear voice sample (10–30 seconds).', icon: '1️⃣' },
  { title: 'Sample 2', instruction: 'Record another sample in a different tone.', icon: '2️⃣' },
  { title: 'Sample 3 (Optional)', instruction: 'Optional additional sample for better accuracy.', icon: '3️⃣' },
]

const SAMPLE_SCRIPTS = [
  "Now I am speaking slowly and clearly. Each word is pronounced properly. This helps the system understand my voice in a clean way.",
  "Now I will speak normally, like in a real conversation. There will be some background noise and I will not be perfectly clear. This helps the system understand my voice in a real-world environment.",
  "Now I will speak with a slightly different pitch. This helps the system recognise my voice when I am excited, happy, calm or serious."
]

export default function AddVoicePage() {
  const [label, setLabel] = useState('')
  const [savedPaths, setSavedPaths] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)

  const handleSampleSaved = (filePath: string, sampleIndex: number) => {
    setSavedPaths((prev) => { const n = [...prev]; n[sampleIndex] = filePath; return n })
  }

  const handleSave = async () => {
    if (!label.trim()) { setError('Please enter a name for this voice.'); return }
    const paths = savedPaths.filter(Boolean)
    if (paths.length === 0) { setError('Record at least one sample.'); return }
    setSubmitting(true); setError('')
    try {
      await api.post('/voice/add-profile', { file_paths: paths, label: label.trim() })
      setSuccess(true)
      setLabel(''); setSavedPaths([]); setStep(0)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save profile.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '1.5rem',
      padding: '2rem'
    }}>
      <div className="animate-bounce-in" style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'hsl(var(--sticky-green) / .3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '3px solid hsl(var(--sticky-green))'
      }}>
        <CheckCircle size={48} style={{ color: 'hsl(var(--sticky-green))' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ 
          fontWeight: 700, 
          fontSize: '1.5rem',
          fontFamily: 'Caveat, cursive',
          marginBottom: '.5rem',
          color: 'hsl(var(--ink))'
        }}>
          Voice profile saved!
        </h2>
        <p style={{ 
          color: 'hsl(var(--pencil))', 
          fontSize: '0.95rem',
          fontFamily: 'Inter, sans-serif',
          maxWidth: '400px'
        }}>
          VoiceSum will now recognise this person in future recordings
        </p>
      </div>
      <button 
        className="btn btn-primary animate-slide-up" 
        onClick={() => setSuccess(false)}
        style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
      >
        <UserPlus size={16} /> Add Another
      </button>
    </div>
  )

  return (
    <div style={{ 
      flex: 1, 
      overflowY: 'auto', 
      padding: '2rem 2.5rem', 
      maxWidth: '700px', 
      margin: '0 auto', 
      width: '100%',
      background: 'hsl(var(--paper) / .5)'
    }}>
      <div className="animate-slide-up" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '.75rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'hsl(var(--accent) / .15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2.5px solid hsl(var(--accent) / .3)'
          }}>
            <UserPlus size={24} style={{ color: 'hsl(var(--accent))' }} />
          </div>
          <div>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 800, 
              fontFamily: 'Caveat, cursive',
              color: 'hsl(var(--ink))',
              lineHeight: 1
            }}>
              Add Voice Profile
            </h1>
            <p style={{ 
              color: 'hsl(var(--pencil))', 
              fontSize: '0.9rem',
              fontFamily: 'Inter, sans-serif',
              marginTop: '.25rem'
            }}>
              Add a teammate, friend, or colleague
            </p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="glass animate-slide-up" style={{ 
        padding: '1.5rem', 
        marginBottom: '1.75rem',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <label className="label" style={{ marginBottom: '.75rem' }}>
          Name / Label *
        </label>
        <input 
          id="voice-label" 
          className="input" 
          placeholder="e.g. Alice, John, Boss" 
          value={label} 
          onChange={(e) => setLabel(e.target.value)} 
        />
      </div>

      {/* Sample script guide */}
      <div className="glass animate-slide-up" style={{ 
        padding: '1.5rem',
        marginBottom: '1.75rem',
        background: 'hsl(var(--sticky-blue) / .15)',
        border: '2.5px dashed hsl(var(--ink) / .25)',
        animationDelay: '0.15s',
        animationFillMode: 'both'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '1rem' 
        }}>
          <Sparkles size={18} style={{ color: 'hsl(var(--accent))' }} />
          <h3 style={{ 
            fontSize: '1rem', 
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            color: 'hsl(var(--ink))'
          }}>
            Sample Scripts (Optional)
          </h3>
        </div>
        {SAMPLE_SCRIPTS.map((script, idx) => (
          <div 
            key={idx}
            style={{
              padding: '.75rem 1rem',
              background: 'hsl(var(--card))',
              borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px',
              border: '2px solid hsl(var(--ink) / .15)',
              marginBottom: idx < SAMPLE_SCRIPTS.length - 1 ? '.75rem' : 0,
              fontSize: '.88rem',
              lineHeight: 1.7,
              fontFamily: 'Inter, sans-serif',
              color: 'hsl(var(--ink-soft))',
              fontStyle: 'italic'
            }}
          >
            <span style={{ 
              fontWeight: 700, 
              color: 'hsl(var(--accent))',
              fontStyle: 'normal',
              marginRight: '.5rem'
            }}>
              {idx + 1}.
            </span>
            {script}
          </div>
        ))}
      </div>

      {/* Step tabs */}
      <div className="animate-slide-up" style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '1.5rem',
        animationDelay: '0.2s',
        animationFillMode: 'both'
      }}>
        {STEPS.map((s, i) => (
          <button 
            key={i} 
            onClick={() => setStep(i)} 
            style={{
              flex: 1, 
              padding: '0.75rem 0.5rem', 
              borderRadius: '12px 16px 14px 18px / 16px 12px 18px 14px', 
              border: step === i ? '2.5px solid hsl(var(--accent))' : '2.5px solid hsl(var(--ink) / .2)', 
              cursor: 'pointer',
              background: step === i ? 'hsl(var(--accent) / .15)' : 'hsl(var(--card))',
              color: step === i ? 'hsl(var(--accent))' : 'hsl(var(--ink-soft))',
              fontSize: '0.85rem', 
              fontWeight: 600,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              transition: 'all 0.2s',
              fontFamily: 'Inter, sans-serif',
              boxShadow: step === i ? '3px 3px 0 0 hsl(var(--accent) / .2)' : '2px 2px 0 0 hsl(var(--ink) / .1)'
            }}
          >
            {savedPaths[i] && <CheckCircle size={14} />}
            <span>{s.icon}</span>
            {s.title}
          </button>
        ))}
      </div>

      <div className="animate-slide-up" style={{ 
        marginBottom: '1.5rem',
        animationDelay: '0.25s',
        animationFillMode: 'both'
      }}>
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '1rem' 
          }}>
            <Mic size={18} style={{ color: 'hsl(var(--accent))' }} />
            <p style={{ 
              fontSize: '0.92rem', 
              color: 'hsl(var(--ink-soft))',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}>
              {STEPS[step].instruction}
            </p>
          </div>
          <VoiceRecorder  
            sampleIndex={step} 
            label={label || 'speaker'} 
            onSampleSaved={handleSampleSaved} 
          />
        </div>

        {step < 2 && (
          <button 
            className="btn btn-ghost" 
            onClick={() => {
              if (!savedPaths[step]) {
                setError("Please record this sample before continuing.");
                return;
              }
              setError('');
              setStep(step + 1);
            }}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Next sample →
          </button>
        )}
      </div>

      {error && (
        <div className="animate-shake" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
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
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <button 
        className="btn btn-primary" 
        onClick={handleSave} 
        disabled={submitting} 
        id="save-voice-btn" 
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {submitting ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
        {submitting ? 'Saving…' : 'Save Voice Profile'}
      </button>
    </div>
  )
}
