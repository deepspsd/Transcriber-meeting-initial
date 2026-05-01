import { useEffect, useState } from 'react'
import { Settings, Mic, Trash2, Pencil, Save, Loader, Sliders } from 'lucide-react'
import api from '../api/client'

interface Profile {
  id: string
  label: string
  sample_count: number
  is_self: boolean
  created_at: string
}

interface UserSettings {
  speaker_similarity_threshold: number
  word_conf_low: number
  word_conf_mid: number
  min_segment_duration: number
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [savingLabel, setSavingLabel] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const loadData = async () => {
    const [pRes, sRes] = await Promise.all([api.get('/voice/profiles'), api.get('/settings')])
    setProfiles(pRes.data)
    setSettings(sRes.data)
    setLoadingProfiles(false)
  }
  useEffect(() => { loadData() }, [])

  const handleRename = async (id: string) => {
    if (!editLabel.trim()) return
    setSavingLabel(true)
    await api.put(`/voice/profiles/${id}`, { label: editLabel })
    setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, label: editLabel } : p))
    setEditingId(null)
    setSavingLabel(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this voice profile?')) return
    setDeletingId(id)
    await api.delete(`/voice/profiles/${id}`)
    setProfiles((prev) => prev.filter((p) => p.id !== id))
    setDeletingId(null)
  }

  const handleSaveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    await api.put('/settings', settings)
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  const upd = (key: keyof UserSettings, val: number) =>
    setSettings((prev) => prev ? { ...prev, [key]: val } : prev)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', maxWidth: '700px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Settings size={20} style={{ color: 'var(--accent)' }} /> Settings
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>Manage voice profiles and recognition thresholds.</p>

      {/* Voice Profiles */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Mic size={16} style={{ color: 'var(--accent)' }} /> Voice Profiles
        </h2>
        {loadingProfiles ? (
          <Loader size={18} className="spin" style={{ color: 'var(--accent)' }} />
        ) : profiles.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No voice profiles saved yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profiles.map((p) => (
              <div key={p.id} className="glass" style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(124,92,252,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                  {p.label[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === p.id ? (
                    <input className="input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename(p.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.875rem' }} autoFocus />
                  ) : (
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.label} {p.is_self && <span className="badge badge-purple" style={{ marginLeft: '6px' }}>You</span>}</div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sample_count} sample{p.sample_count !== 1 ? 's' : ''} · {new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {editingId === p.id ? (
                    <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleRename(p.id)} disabled={savingLabel}>
                      {savingLabel ? <Loader size={12} className="spin" /> : <Save size={12} />} Save
                    </button>
                  ) : (
                    <button className="btn btn-ghost" style={{ padding: '0.35rem 0.75rem' }} onClick={() => { setEditingId(p.id); setEditLabel(p.label) }}>
                      <Pencil size={13} />
                    </button>
                  )}
                  <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem' }} onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}>
                    {deletingId === p.id ? <Loader size={13} className="spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Threshold settings */}
      {settings && (
        <section>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Sliders size={16} style={{ color: 'var(--accent)' }} /> Recognition Thresholds
          </h2>
          <div className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {([
              { key: 'speaker_similarity_threshold', label: 'Speaker Similarity Threshold', min: 0.5, max: 0.99, step: 0.01, desc: 'Minimum cosine similarity to match a known speaker (default: 0.75)' },
              { key: 'word_conf_low', label: 'Low Confidence Threshold', min: 0.3, max: 0.9, step: 0.01, desc: 'Words below this are highlighted red (default: 0.70)' },
              { key: 'word_conf_mid', label: 'Mid Confidence Threshold', min: 0.5, max: 0.99, step: 0.01, desc: 'Words below this are highlighted yellow (default: 0.85)' },
              { key: 'min_segment_duration', label: 'Min. Segment Duration (s)', min: 0.5, max: 5, step: 0.5, desc: 'Segments shorter than this are ignored (default: 1.5s)' },
            ] as const).map(({ key, label, min, max, step, desc }) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</label>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', color: 'var(--accent)' }}>{settings[key]}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={settings[key]}
                  onChange={(e) => upd(key, parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</p>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ marginTop: '1rem' }} id="save-settings-btn">
            {savingSettings ? <Loader size={15} className="spin" /> : <Save size={15} />}
            {settingsSaved ? 'Saved!' : savingSettings ? 'Saving…' : 'Save Settings'}
          </button>
        </section>
      )}
    </div>
  )
}
