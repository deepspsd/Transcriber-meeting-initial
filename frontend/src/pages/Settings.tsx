import { useEffect, useState } from 'react'
import { Settings, Mic, Trash2, Pencil, Save, Loader, Sliders, Sparkles, User, CheckCircle } from 'lucide-react'
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

  const PROFILE_COLORS = [
    'hsl(14, 90%, 56%)',
    'hsl(205, 90%, 55%)',
    'hsl(130, 60%, 45%)',
    'hsl(280, 70%, 60%)',
    'hsl(45, 90%, 50%)',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Panel Header */}
      <div className="panel-header">
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
          background: 'hsl(var(--accent) / .12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid hsl(var(--accent) / .3)',
        }}>
          <Settings size={16} style={{ color: 'hsl(var(--accent))' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1>Settings</h1>
          <p style={{ fontSize: '.82rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', fontWeight: 400, marginTop: '1px' }}>
            Voice profiles &amp; recognition thresholds
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="page-wrapper">

      {/* Page title - REMOVED, now in panel-header */}

      {/* ─── Voice Profiles ─── */}
      <section className="animate-slide-up" style={{ marginBottom: '2.5rem', animationDelay: '0.05s', animationFillMode: 'both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '9px',
            background: 'hsl(205,90%,55% / .12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid hsl(205,90%,55% / .25)',
          }}>
            <Mic size={18} style={{ color: 'hsl(205,90%,55%)' }} />
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))' }}>
            Voice Profiles
          </h2>
          <span style={{
            fontSize: '.76rem', fontWeight: 600,
            color: 'hsl(235,80%,60%)',
            background: 'hsl(235,80%,60% / .1)',
            padding: '.15rem .55rem', borderRadius: '999px',
            border: '1.5px solid hsl(235,80%,60% / .25)',
            fontFamily: 'Inter, sans-serif'
          }}>
            {profiles.length}
          </span>
        </div>

        {loadingProfiles ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
            <Loader size={28} className="spin" style={{ color: 'hsl(var(--accent))' }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '.9rem', color: 'hsl(var(--pencil))' }}>Loading profiles…</p>
          </div>
        ) : profiles.length === 0 ? (
          <div style={{
            padding: '3.5rem 2rem', textAlign: 'center',
            background: 'hsl(var(--card))',
            border: '1.5px dashed hsl(var(--ink) / .15)',
            borderRadius: '12px'
          }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'hsl(var(--accent) / .08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}>
              <User size={28} style={{ opacity: 0.3, color: 'hsl(var(--accent))' }} className="animate-float" />
            </div>
            <p style={{ color: 'hsl(var(--pencil))', fontSize: '.95rem', fontFamily: 'Inter, sans-serif' }}>
              No voice profiles saved yet
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {profiles.map((p, idx) => {
              const color = PROFILE_COLORS[idx % PROFILE_COLORS.length]
              return (
                <div
                  key={p.id}
                  className="animate-slide-up"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '1.1rem 1.25rem',
                    background: 'hsl(var(--card))',
                    border: '1.5px solid hsl(var(--ink) / .1)',
                    borderLeft: `4px solid ${color}`,
                    borderRadius: '0 10px 10px 0',
                    animationDelay: `${0.1 + idx * 0.04}s`,
                    animationFillMode: 'both'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: `${color}1a`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color, fontWeight: 700, fontSize: '1.1rem', flexShrink: 0,
                    border: `2px solid ${color}40`,
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {p.label[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingId === p.id ? (
                      <input
                        className="input"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(p.id)}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '.95rem', height: '36px' }}
                        autoFocus
                      />
                    ) : (
                      <div style={{ fontWeight: 600, fontSize: '1rem', fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {p.label}
                        {p.is_self && (
                          <span style={{
                            fontSize: '.68rem', fontWeight: 600,
                            color: 'hsl(235,80%,60%)', background: 'hsl(235,80%,60% / .1)',
                            padding: '.1rem .45rem', borderRadius: '999px',
                            border: '1.5px solid hsl(235,80%,60% / .25)',
                            fontFamily: 'Inter, sans-serif',
                            display: 'inline-flex', alignItems: 'center', gap: '3px'
                          }}>
                            <Sparkles size={10} /> You
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif' }}>
                      {p.sample_count} sample{p.sample_count !== 1 ? 's' : ''} · {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {editingId === p.id ? (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', height: '36px' }}
                        onClick={() => handleRename(p.id)}
                        disabled={savingLabel}
                      >
                        {savingLabel ? <Loader size={13} className="spin" /> : <Save size={13} />} Save
                      </button>
                    ) : (
                      <button
                        className="icon-btn"
                        style={{ width: '36px', height: '36px' }}
                        onClick={() => { setEditingId(p.id); setEditLabel(p.label) }}
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      className="icon-btn"
                      style={{ width: '36px', height: '36px', color: 'hsl(var(--destructive))' }}
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      title="Delete"
                    >
                      {deletingId === p.id ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── Recognition Thresholds ─── */}
      {settings && (
        <section className="animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: 'hsl(45,90%,50% / .15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid hsl(45,90%,50% / .3)',
            }}>
              <Sliders size={18} style={{ color: 'hsl(45,90%,50%)' }} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))' }}>
              Recognition Thresholds
            </h2>
          </div>

          <div style={{
            padding: '1.75rem',
            background: 'hsl(var(--card))',
            border: '1.5px solid hsl(var(--ink) / .1)',
            borderRadius: '12px',
            display: 'flex', flexDirection: 'column', gap: '2rem'
          }}>
            {([
              { key: 'speaker_similarity_threshold', label: 'Speaker Similarity Threshold', min: 0.5, max: 0.99, step: 0.01, desc: 'Minimum cosine similarity to match a known speaker (default: 0.75)' },
              { key: 'word_conf_low', label: 'Low Confidence Threshold', min: 0.3, max: 0.9, step: 0.01, desc: 'Words below this are highlighted red (default: 0.70)' },
              { key: 'word_conf_mid', label: 'Mid Confidence Threshold', min: 0.5, max: 0.99, step: 0.01, desc: 'Words below this are highlighted yellow (default: 0.85)' },
              { key: 'min_segment_duration', label: 'Min. Segment Duration (s)', min: 0.5, max: 5, step: 0.5, desc: 'Segments shorter than this are ignored (default: 1.5s)' },
            ] as const).map(({ key, label, min, max, step, desc }) => {
              const pct = ((settings[key] - min) / (max - min)) * 100
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '.95rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', color: 'hsl(var(--ink))' }}>
                      {label}
                    </label>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '.9rem',
                      color: 'hsl(var(--accent))', fontWeight: 700,
                      padding: '.3rem .65rem',
                      background: 'hsl(var(--accent) / .1)',
                      borderRadius: '6px',
                      border: '1.5px solid hsl(var(--accent) / .2)',
                      minWidth: '56px', textAlign: 'center'
                    }}>
                      {settings[key]}
                    </span>
                  </div>

                  {/* Custom slider track */}
                  <div style={{ position: 'relative', height: '8px', background: 'hsl(var(--muted))', borderRadius: '999px', marginBottom: '8px' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: 'hsl(var(--accent))',
                      borderRadius: '999px',
                      transition: 'width .1s',
                    }} />
                  </div>
                  <input
                    type="range"
                    min={min} max={max} step={step}
                    value={settings[key]}
                    onChange={(e) => upd(key, parseFloat(e.target.value))}
                    style={{
                      width: '100%', accentColor: 'hsl(var(--accent))',
                      height: '4px', cursor: 'pointer',
                      marginTop: '-12px', marginBottom: '4px',
                      opacity: 0.01, position: 'relative', zIndex: 2,
                    }}
                  />
                  <p style={{ fontSize: '0.82rem', color: 'hsl(var(--pencil))', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                    {desc}
                  </p>
                </div>
              )
            })}
          </div>

          <button
            className={`btn ${settingsSaved ? 'btn-success' : 'btn-primary'}`}
            onClick={handleSaveSettings}
            disabled={savingSettings}
            style={{ marginTop: '1.5rem', padding: '.75rem 1.75rem', fontSize: '.95rem' }}
            id="save-settings-btn"
          >
            {savingSettings ? <Loader size={16} className="spin" /> : settingsSaved ? <CheckCircle size={16} /> : <Save size={16} />}
            {settingsSaved ? 'Settings Saved!' : savingSettings ? 'Saving…' : 'Save Settings'}
          </button>
        </section>
      )}
      </div>
    </div>
  )
}
