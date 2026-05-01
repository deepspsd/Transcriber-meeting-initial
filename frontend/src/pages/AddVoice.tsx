import { useState } from 'react'
import { CheckCircle, UserPlus, Loader, AlertTriangle } from 'lucide-react'
import VoiceRecorder from '../components/VoiceRecorder'
import api from '../api/client'

const STEPS = [
  { title: 'Sample 1', instruction: 'Record a clear voice sample (10–30 seconds).' },
  { title: 'Sample 2', instruction: 'Record another sample in a different tone.' },
  { title: 'Sample 3 (Optional)', instruction: 'Optional additional sample for better accuracy.' },
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <CheckCircle size={48} style={{ color: 'var(--accent-success)' }} />
      <h2 style={{ fontWeight: 700 }}>Voice profile saved!</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>VoiceSum will now recognise this person in future recordings.</p>
      <button className="btn btn-primary" onClick={() => setSuccess(false)}><UserPlus size={15} /> Add Another</button>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', maxWidth: '620px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={20} style={{ color: 'var(--accent)' }} /> Add Voice Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Add a teammate, friend, or colleague so VoiceSum recognises them in conversations.</p>
      </div>

      {/* Name */}
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Name / Label *</label>
        <input id="voice-label" className="input" placeholder="e.g. Alice, John, Boss" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        Now I am speaking slowly and clearly.
        Each word is pronounced properly.
        This helps the system understand my voice in a clean way.
        <br />
        Now I will speak normally, like in a real conversation.
        There will be some background noise and I will not be perfectly clear.
        <br />
        This helps the system understand my voice in a real-world environment.
        <br />
        Now I will speak with a slightly higher pitch.
        This helps the system recognise my voice when I am excited or happy.
        <br />

        Finally, I will speak with a slightly lower pitch.
        This helps the system recognise my voice when I am calm or serious.
      </div>
      {/* Step tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            flex: 1, padding: '0.55rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: step === i ? 'var(--accent)' : 'var(--bg-elevated)',
            color: step === i ? '#fff' : 'var(--text-secondary)', fontSize: '0.77rem', fontWeight: 600, transition: 'all 0.18s',
          }}>
            {savedPaths[i] ? '✓ ' : ''}{s.title}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{STEPS[step].instruction}</p>
        <VoiceRecorder  sampleIndex={step} label={label || 'speaker'} onSampleSaved={handleSampleSaved} />
      </div>

      {step < 2 && (
        <button className="btn btn-ghost" style={{ marginBottom: '1rem' }} onClick={() => {
          if (!savedPaths[step]) {
            setError("Please record this sample before continuing.");
            return;
          }
          setError('');
          setStep(step + 1);
        }}>
          Next sample →
        </button>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-danger)', fontSize: '0.83rem', marginBottom: '0.75rem' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSave} disabled={submitting} id="save-voice-btn" style={{ width: '100%', justifyContent: 'center' }}>
        {submitting ? <Loader size={15} className="spin" /> : <CheckCircle size={15} />}
        {submitting ? 'Saving…' : 'Save Voice Profile'}
      </button>
    </div>
  )
}
