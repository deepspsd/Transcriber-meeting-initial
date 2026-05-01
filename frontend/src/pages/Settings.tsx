import { useEffect, useState } from 'react'
import { Settings, Mic, Trash2, Pencil, Save, Loader, Sliders, Sparkles, User } from 'lucide-react'
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
    <div style={{ 
      flex: 1, 
      overflowY: 'auto', 
      padding: '3rem 3rem 4rem', 
      maxWidth: '900px', 
      margin: '0 auto', 
      width: '100%',
      background: 'hsl(var(--paper) / .5)'
    }}>
      <div className="animate-slide-up" style={{ marginBottom: '3.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'hsl(var(--accent) / .15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2.5px solid hsl(var(--accent) / .3)'
          }}>
            <Settings size={28} style={{ color: 'hsl(var(--accent))' }} />
          </div>
          <div>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: 800, 
              fontFamily: 'Caveat, cursive',
              color: 'hsl(var(--ink))',
              lineHeight: 1,
              marginBottom: '.35rem'
            }}>
              Settings
            </h1>
            <p style={{ 
              color: 'hsl(var(--pencil))', 
              fontSize: '1rem',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400
            }}>
              Manage voice profiles and recognition thresholds
            </p>
          </div>
        </div>
      </div>

      {/* Voice Profiles */}
      <section className="animate-slide-up" style={{ 
        marginBottom: '4rem',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '1.75rem' 
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'hsl(var(--sticky-blue) / .3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid hsl(var(--ink) / .2)'
          }}>
            <Mic size={20} style={{ color: 'hsl(var(--ink))' }} />
          </div>
          <h2 style={{ 
            fontSize: '1.35rem', 
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            color: 'hsl(var(--ink))'
          }}>
            Voice Profiles
          </h2>
          <span className="badge badge-purple" style={{ fontSize: '.85rem', padding: '.3rem .75rem' }}>
            {profiles.length}
          </span>
        </div>

        {loadingProfiles ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '4rem',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <Loader size={32} className="spin" style={{ color: 'hsl(var(--accent))' }} />
            <p style={{ 
              fontFamily: 'Inter, sans-serif', 
              fontSize: '1rem',
              color: 'hsl(var(--pencil))'
            }}>
              Loading profiles...
            </p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="glass" style={{ 
            padding: '4rem 2.5rem',
            textAlign: 'center'
          }}>
            <User 
              size={48} 
              style={{ 
                margin: '0 auto 1.5rem', 
                display: 'block', 
                opacity: 0.3,
                color: 'hsl(var(--accent))'
              }}
              className="animate-float"
            />
            <p style={{ 
              color: 'hsl(var(--pencil))', 
              fontSize: '1rem',
              fontFamily: 'Inter, sans-serif'
            }}>
              No voice profiles saved yet
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {profiles.map((p, idx) => (
              <div 
                key={p.id} 
                className="card-hover animate-slide-up" 
                style={{ 
                  padding: '1.5rem 1.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '18px',
                  animationDelay: `${0.1 + idx * 0.05}s`,
                  animationFillMode: 'both'
                }}
              >
                <div style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '50%', 
                  background: 'hsl(var(--accent) / .2)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'hsl(var(--accent))', 
                  fontWeight: 700, 
                  fontSize: '1.3rem', 
                  flexShrink: 0,
                  border: '2.5px solid hsl(var(--accent) / .4)',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {p.label[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === p.id ? (
                    <input 
                      className="input" 
                      value={editLabel} 
                      onChange={(e) => setEditLabel(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(p.id)} 
                      style={{ 
                        padding: '0.65rem 0.9rem', 
                        fontSize: '1rem' 
                      }} 
                      autoFocus 
                    />
                  ) : (
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: '1.1rem',
                      fontFamily: 'Inter, sans-serif',
                      color: 'hsl(var(--ink))',
                      marginBottom: '6px'
                    }}>
                      {p.label} 
                      {p.is_self && (
                        <span className="badge badge-purple" style={{ marginLeft: '10px', fontSize: '.8rem' }}>
                          <Sparkles size={12} /> You
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '0.88rem', 
                    color: 'hsl(var(--pencil))',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {p.sample_count} sample{p.sample_count !== 1 ? 's' : ''} · {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {editingId === p.id ? (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }} 
                      onClick={() => handleRename(p.id)} 
                      disabled={savingLabel}
                    >
                      {savingLabel ? <Loader size={15} className="spin" /> : <Save size={15} />} Save
                    </button>
                  ) : (
                    <button 
                      className="icon-btn" 
                      style={{ width: '40px', height: '40px' }}
                      onClick={() => { setEditingId(p.id); setEditLabel(p.label) }}
                      title="Rename"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button 
                    className="icon-btn" 
                    style={{ 
                      width: '40px',
                      height: '40px',
                      borderColor: 'hsl(var(--destructive) / .3)',
                      color: 'hsl(var(--destructive))'
                    }}
                    onClick={() => handleDelete(p.id)} 
                    disabled={deletingId === p.id}
                    title="Delete"
                  >
                    {deletingId === p.id ? <Loader size={16} className="spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Threshold settings */}
      {settings && (
        <section className="animate-slide-up" style={{
          animationDelay: '0.2s',
          animationFillMode: 'both'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '1.75rem' 
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'hsl(var(--sticky-yellow) / .4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid hsl(var(--ink) / .2)'
            }}>
              <Sliders size={20} style={{ color: 'hsl(var(--ink))' }} />
            </div>
            <h2 style={{ 
              fontSize: '1.35rem', 
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              color: 'hsl(var(--ink))'
            }}>
              Recognition Thresholds
            </h2>
          </div>

          <div className="glass" style={{ 
            padding: '2.25rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2.25rem' 
          }}>
            {([
              { key: 'speaker_similarity_threshold', label: 'Speaker Similarity Threshold', min: 0.5, max: 0.99, step: 0.01, desc: 'Minimum cosine similarity to match a known speaker (default: 0.75)' },
              { key: 'word_conf_low', label: 'Low Confidence Threshold', min: 0.3, max: 0.9, step: 0.01, desc: 'Words below this are highlighted red (default: 0.70)' },
              { key: 'word_conf_mid', label: 'Mid Confidence Threshold', min: 0.5, max: 0.99, step: 0.01, desc: 'Words below this are highlighted yellow (default: 0.85)' },
              { key: 'min_segment_duration', label: 'Min. Segment Duration (s)', min: 0.5, max: 5, step: 0.5, desc: 'Segments shorter than this are ignored (default: 1.5s)' },
            ] as const).map(({ key, label, min, max, step, desc }) => (
              <div key={key}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '10px',
                  alignItems: 'center'
                }}>
                  <label style={{ 
                    fontSize: '1rem', 
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    color: 'hsl(var(--ink))'
                  }}>
                    {label}
                  </label>
                  <span style={{ 
                    fontFamily: 'JetBrains Mono, monospace', 
                    fontSize: '1rem', 
                    color: 'hsl(var(--accent))',
                    fontWeight: 600,
                    padding: '.35rem .75rem',
                    background: 'hsl(var(--accent) / .1)',
                    borderRadius: '8px',
                    border: '2px solid hsl(var(--accent) / .2)'
                  }}>
                    {settings[key]}
                  </span>
                </div>
                <input 
                  type="range" 
                  min={min} 
                  max={max} 
                  step={step} 
                  value={settings[key]}
                  onChange={(e) => upd(key, parseFloat(e.target.value))}
                  style={{ 
                    width: '100%', 
                    accentColor: 'hsl(var(--accent))',
                    height: '10px',
                    cursor: 'pointer'
                  }}
                />
                <p style={{ 
                  fontSize: '0.88rem', 
                  color: 'hsl(var(--pencil))', 
                  marginTop: '8px',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.6
                }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleSaveSettings} 
            disabled={savingSettings} 
            style={{ marginTop: '1.5rem', padding: '.75rem 1.5rem', fontSize: '1rem' }} 
            id="save-settings-btn"
          >
            {savingSettings ? <Loader size={18} className="spin" /> : <Save size={18} />}
            {settingsSaved ? '✓ Saved!' : savingSettings ? 'Saving…' : 'Save Settings'}
          </button>
        </section>
      )}
    </div>
  )
}
